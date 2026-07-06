from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.models import TelemetryLog, Project, Gateway
from app.routers.auth import get_current_user, require_role
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
import json
import re

router = APIRouter(prefix="/api/telemetry", tags=["Telemetry Logs"])

_PARTITION_NAME_PATTERN = re.compile(r"^telemetry_logs_(\d{4})_(\d{2})$")


@router.get("/recent")
def get_recent_telemetry(
    company_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("admin", "rasindo_operator", "rasindo_user"):
        if company_id != current_user["company_id"]:
            raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke data company ini.")

    try:
        telemetry_data = db.query(TelemetryLog)\
            .join(Gateway, TelemetryLog.gateway_id == Gateway.gateway_id)\
            .join(Project, Gateway.project_id == Project.project_id)\
            .filter(Project.company_id == company_id)\
            .order_by(TelemetryLog.created_at.desc())\
            .limit(limit)\
            .all()

        formatted_telemetry = []
        for log in telemetry_data:
            parsed_payload = json.loads(log.payload) if isinstance(log.payload, str) else log.payload
            formatted_telemetry.append({
                "id": log.id,
                "gateway_id": log.gateway_id,
                "payload": parsed_payload,
                "created_at": log.created_at.isoformat() if log.created_at else None
            })

        return {"status": "success", "data": formatted_telemetry}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memuat telemetri terbaru: {str(e)}"
        )


# ==============================================================================
# 🌟 PARTITION MAINTENANCE -- dipanggil dari cron job di main.py
# ==============================================================================
def ensure_future_partitions(db: Session, months_ahead: int = 2):
    """
    Pastikan partition untuk bulan ini + N bulan ke depan sudah ada.
    Idempotent -- aman dipanggil berkali-kali (pakai IF NOT EXISTS).
    """
    today = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    for i in range(months_ahead + 1):
        start = today + relativedelta(months=i)
        end = start + relativedelta(months=1)
        partition_name = f"telemetry_logs_{start.strftime('%Y_%m')}"

        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {partition_name}
            PARTITION OF telemetry_logs
            FOR VALUES FROM (:start) TO (:end)
        """), {"start": start, "end": end})

        # Autovacuum tuning tidak otomatis nurun ke partition baru,
        # jadi di-set eksplisit tiap kali partition baru dibuat.
        db.execute(text(f"""
            ALTER TABLE {partition_name}
            SET (autovacuum_vacuum_scale_factor = 0.05)
        """))

    db.commit()
    print(f"✅ Partition telemetry_logs siap untuk {months_ahead + 1} bulan ke depan")


def _list_old_partitions(db: Session, months_retention: int = 6):
    """
    Cari nama partition yang seluruh datanya lebih tua dari retention
    period, berdasarkan nama tabel (format telemetry_logs_YYYY_MM),
    BUKAN dengan scan isi tabel -- jauh lebih cepat.
    """
    cutoff = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0) \
        - relativedelta(months=months_retention)

    rows = db.execute(text("""
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename ~ '^telemetry_logs_[0-9]{4}_[0-9]{2}$'
    """)).fetchall()

    old_partitions = []
    for row in rows:
        match = _PARTITION_NAME_PATTERN.match(row.tablename)
        if not match:
            continue
        year, month = int(match.group(1)), int(match.group(2))
        partition_start = datetime(year, month, 1, tzinfo=timezone.utc)
        if partition_start < cutoff:
            old_partitions.append(row.tablename)

    return old_partitions


# ==============================================================================
# 🌟 ARCHIVE: agregasi ke summary bulanan, LALU DROP PARTITION (bukan DELETE)
# DROP TABLE pada partition itu instant -- tidak ada baris yang di-scan
# atau dihapus satu-satu, jadi tidak ada bloat dan tidak makan waktu lama
# walau partition-nya berisi jutaan baris.
# ==============================================================================
@router.post("/archive-old-data")
def archive_old_telemetry(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "rasindo_operator")),
):
    try:
        old_partitions = _list_old_partitions(db, months_retention=6)

        if not old_partitions:
            return {"status": "success", "message": "Kondisi aman. Tidak ada partition telemetri yang berumur lebih dari 6 bulan."}

        total_archived_months = 0
        dropped_partitions = []

        for partition_name in old_partitions:
            match = _PARTITION_NAME_PATTERN.match(partition_name)
            year, month = int(match.group(1)), int(match.group(2))

            # Agregasi per project_id, langsung dari partition itu saja
            # (jauh lebih ringan daripada scan seluruh telemetry_logs).
            query_old_data = text(f"""
                SELECT g.project_id AS project_id, t.payload
                FROM {partition_name} t
                JOIN gateways g ON t.gateway_id = g.gateway_id
                WHERE g.project_id IS NOT NULL
            """)
            old_logs = db.execute(query_old_data).fetchall()

            grouped_by_project = {}
            for log in old_logs:
                grouped_by_project.setdefault(log.project_id, []).append(
                    json.loads(log.payload) if isinstance(log.payload, str) else log.payload
                )

            for project_id, payloads in grouped_by_project.items():
                if not payloads:
                    continue

                sum_channels, count_channels, static_channels = {}, {}, {}

                for p in payloads:
                    if not isinstance(p, dict):
                        continue
                    for k, v in p.items():
                        try:
                            val_float = float(v)
                            sum_channels[k] = sum_channels.get(k, 0.0) + val_float
                            count_channels[k] = count_channels.get(k, 0) + 1
                        except (ValueError, TypeError):
                            static_channels[k] = v

                averaged_payload = {k: round(sum_channels[k] / count_channels[k], 2) for k in sum_channels}
                averaged_payload.update(static_channels)

                db.execute(text("""
                    INSERT INTO monthly_telemetry_summary (project_id, year, month, averaged_payload)
                    VALUES (:p_id, :yr, :mth, :payload)
                    ON CONFLICT DO NOTHING
                """), {
                    "p_id": project_id,
                    "yr": year,
                    "mth": month,
                    "payload": json.dumps(averaged_payload)
                })

                total_archived_months += 1

            # 🔥 Instant, tidak ada bloat -- beda jauh dari DELETE baris satu-satu
            db.execute(text(f"DROP TABLE IF EXISTS {partition_name}"))
            dropped_partitions.append(partition_name)

        db.commit()
        return {
            "status": "success",
            "message": (
                f"Sukses optimasi! {len(dropped_partitions)} partition ({', '.join(dropped_partitions)}) "
                f"dikompres menjadi {total_archived_months} log bulanan lalu di-drop. Storage dibersihkan instant."
            )
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal melakukan otomatisasi pembersihan & kompresi data: {str(e)}"
        )