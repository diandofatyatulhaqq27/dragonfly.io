from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.models import TelemetryLog, Project
from app.routers.auth import get_current_user, require_role
import json

router = APIRouter(prefix="/api/telemetry", tags=["Telemetry Logs"])

@router.get("/recent")
def get_recent_telemetry(
    company_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # 🌟 Cegah IDOR: non-admin/operator hanya boleh minta data company sendiri,
    # walau mereka kirim company_id lain lewat query param.
    if current_user["role"] not in ("admin", "rasindo_operator", "rasindo_user"):
        if company_id != current_user["company_id"]:
            raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke data company ini.")

    try:
        telemetry_data = db.query(TelemetryLog)\
            .join(Project, TelemetryLog.project_id == Project.project_id)\
            .filter(Project.company_id == company_id)\
            .order_by(TelemetryLog.created_at.desc())\
            .limit(limit)\
            .all()

        formatted_telemetry = []
        for log in telemetry_data:
            parsed_payload = json.loads(log.payload) if isinstance(log.payload, str) else log.payload
            formatted_telemetry.append({
                "id": log.id,
                "project_id": log.project_id,
                "payload": parsed_payload,
                "created_at": log.created_at.isoformat() if log.created_at else None
            })

        return {"status": "success", "data": formatted_telemetry}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memuat telemetri terbaru: {str(e)}"
        )


@router.post("/archive-old-data")
def archive_old_telemetry(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "rasindo_operator")),
):
    # ... isi fungsi TIDAK BERUBAH, cuma tambahan proteksi di parameter di atas
    try:
        query_projects = text("""
            SELECT DISTINCT project_id 
            FROM telemetry_logs 
            WHERE created_at < NOW() - INTERVAL '6 months'
        """)
        projects = db.execute(query_projects).fetchall()

        if not projects:
            return {"status": "success", "message": "Kondisi aman. Tidak ada data telemetri yang berumur lebih dari 6 months."}

        total_archived_months = 0

        for row in projects:
            p_id = row.project_id
            query_old_data = text("""
                SELECT 
                    EXTRACT(YEAR FROM created_at)::int AS yr,
                    EXTRACT(MONTH FROM created_at)::int AS mth,
                    payload
                FROM telemetry_logs
                WHERE project_id = :p_id AND created_at < NOW() - INTERVAL '6 months'
            """)
            old_logs = db.execute(query_old_data, {"p_id": p_id}).fetchall()

            grouped_data = {}
            for log in old_logs:
                key = (log.yr, log.mth)
                if key not in grouped_data:
                    grouped_data[key] = []
                parsed_payload = json.loads(log.payload) if isinstance(log.payload, str) else log.payload
                grouped_data[key].append(parsed_payload)

            for (yr, mth), payloads in grouped_data.items():
                if not payloads:
                    continue

                sum_channels = {}
                count_channels = {}
                static_channels = {}

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

                averaged_payload = {}
                for k in sum_channels.keys():
                    averaged_payload[k] = round(sum_channels[k] / count_channels[k], 2)

                for k, v in static_channels.items():
                    averaged_payload[k] = v

                db.execute(text("""
                    INSERT INTO monthly_telemetry_summary (project_id, year, month, averaged_payload)
                    VALUES (:p_id, :yr, :mth, :payload)
                    ON CONFLICT DO NOTHING
                """), {
                    "p_id": p_id,
                    "yr": yr,
                    "mth": mth,
                    "payload": json.dumps(averaged_payload)
                })

                total_archived_months += 1

            db.execute(text("""
                DELETE FROM telemetry_logs
                WHERE project_id = :p_id AND created_at < NOW() - INTERVAL '6 months'
            """), {"p_id": p_id})

        db.commit()
        return {
            "status": "success",
            "message": f"Sukses optimasi! Data berumur +6 bulan dikompres menjadi {total_archived_months} log bulanan. Storage dibersihkan."
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal melakukan otomatisasi pembersihan & kompresi data: {str(e)}"
        )