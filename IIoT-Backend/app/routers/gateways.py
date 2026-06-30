from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.models import Gateway, Project, TelemetryLog
from app.routers.auth import get_current_user
from typing import Optional, List, Any
import re
import pytz
from datetime import datetime

router = APIRouter(prefix="/api/gateways", tags=["Gateways"])

WIB = pytz.timezone("Asia/Jakarta")

class GatewaySchema(BaseModel):
    gateway_id: Optional[int] = None
    hmi_code: Optional[str] = None
    name: str
    project_id: Optional[int] = None
    status: Optional[str] = "offline"
    config: Optional[List[Any]] = []

    class Config:
        from_attributes = True

# ─── Bucket config per range — pakai date_bin() PostgreSQL (presisi, native) ──
#
# date_bin(stride, source, origin) membulatkan timestamp ke kelipatan terdekat
# dari `stride`, dihitung dari `origin`. Jauh lebih bersih daripada FLOOR(EXTRACT()).
#
# max_points: safety limit — kalau hasil bucket lebih dari ini, sesuatu salah
# (misal data corrupt atau range terlalu lebar), query tetap dibatasi.

RANGE_CONFIG = {
    "1h":  {"lookback": "1 hour",   "bucket": "1 minute",   "max_points": 70  },
    "6h":  {"lookback": "6 hours",  "bucket": "5 minutes",  "max_points": 80  },
    "24h": {"lookback": "24 hours", "bucket": "15 minutes", "max_points": 100 },
    "7d":  {"lookback": "7 days",   "bucket": "1 hour",     "max_points": 175 },
    "30d": {"lookback": "30 days",  "bucket": "6 hours",    "max_points": 125 },
}

# Whitelist key MQTT — hanya huruf, angka, underscore. Mencegah SQL injection
# lewat parameter `keys` walau sudah pakai bound parameter untuk value lain.
_VALID_KEY_PATTERN = re.compile(r"^[a-zA-Z0-9_]+$")


def _validate_keys(key_list: List[str]) -> List[str]:
    """Filter hanya key yang match pola aman. Key tidak valid di-skip diam-diam."""
    return [k for k in key_list if _VALID_KEY_PATTERN.match(k)]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_gateway(gateway: GatewaySchema, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    if role not in ["admin", "rasindo_operator"]:
        raise HTTPException(status_code=403, detail="Akses ditolak!")
    db_gateway = Gateway(hmi_code=gateway.hmi_code, name=gateway.name, project_id=gateway.project_id, status=gateway.status)
    try:
        db.add(db_gateway)
        db.commit()
        db.refresh(db_gateway)
        return {"status": "success", "data": db_gateway}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan: {str(e)}")


@router.get("/")
def get_gateways(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        role = current_user.get("role")
        user_company_id = current_user.get("company_id")
        if role in ["client_operator", "client_user"]:
            gateways = (
                db.query(Gateway)
                .join(Project, Gateway.project_id == Project.project_id)
                .filter(Project.company_id == user_company_id)
                .all()
            )
            return {"status": "success", "data": gateways}
        gateways = db.query(Gateway).all()
        return {"status": "success", "data": gateways}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{gateway_id}")
def get_gateway(gateway_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    gateway = db.query(Gateway).filter(Gateway.gateway_id == gateway_id).first()
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway tidak ditemukan")

    logs = (
        db.query(TelemetryLog)
        .filter(TelemetryLog.gateway_id == gateway_id)
        .order_by(TelemetryLog.created_at.desc())
        .limit(200)
        .all()
    )
    logs_asc = list(reversed(logs))

    return {
        "status": "success",
        "data": {
            "gateway_id": gateway.gateway_id,
            "name": gateway.name,
            "hmi_code": gateway.hmi_code,
            "status": gateway.status,
            "last_ping": gateway.last_ping,
            "project_id": gateway.project_id,
            "config": gateway.config if gateway.config is not None else [],
            "logs": [
                {
                    "id": l.id,
                    "created_at": l.created_at.isoformat() if l.created_at else None,
                    "payload": l.payload,
                    "gateway_id": l.gateway_id,
                }
                for l in logs_asc
            ]
        }
    }


@router.get("/{gateway_id}/chart")
def get_gateway_chart(
    gateway_id: int,
    range: str = Query(default="1h", regex="^(1h|6h|24h|7d|30d)$"),
    keys: str = Query(default=""),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Endpoint chart Grafana-style — data pre-aggregated per bucket waktu via
    PostgreSQL date_bin(), dengan bound parameters penuh (tidak ada raw
    f-string interpolation untuk angka/value, hanya nama kolom yang sudah
    divalidasi whitelist).

    Contoh: GET /api/gateways/1/chart?range=30d&keys=tempSensor,humidSensor
    Response: { data: [{ time, tempSensor, humidSensor }, ...] }
    """
    gateway = db.query(Gateway).filter(Gateway.gateway_id == gateway_id).first()
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway tidak ditemukan")

    cfg = RANGE_CONFIG.get(range, RANGE_CONFIG["1h"])

    raw_keys = [k.strip() for k in keys.split(",") if k.strip()] if keys else []
    key_list = _validate_keys(raw_keys)
    if not key_list:
        return {"status": "success", "data": []}

    try:
        # select_parts hanya berisi nama kolom yang sudah divalidasi regex,
        # bukan input user mentah → aman dari SQL injection meski berupa f-string.
        select_parts = ", ".join(
            f'AVG((payload->>\'{k}\')::double precision) AS "{k}"' for k in key_list
        )

        sql = text(f"""
            SELECT
                date_bin(
                    CAST(:bucket AS interval),
                    created_at,
                    TIMESTAMPTZ 'epoch'
                ) AS bucket,
                {select_parts}
            FROM telemetry_logs
            WHERE gateway_id = :gateway_id
              AND created_at >= NOW() - CAST(:lookback AS interval)
            GROUP BY bucket
            ORDER BY bucket ASC
            LIMIT :max_points
        """)

        rows = db.execute(sql, {
            "gateway_id": gateway_id,
            "bucket":     cfg["bucket"],
            "lookback":   cfg["lookback"],
            "max_points": cfg["max_points"],
        }).fetchall()

        result = []
        for row in rows:
            point = {"time": row[0].isoformat() if row[0] else None}
            for i, k in enumerate(key_list):
                val = row[i + 1]
                point[k] = round(float(val), 4) if val is not None else None
            result.append(point)

        return {"status": "success", "data": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chart query error: {str(e)}")


@router.get("/{gateway_id}/logs")
def get_gateway_logs(
    gateway_id: int,
    start_date: Optional[str] = Query(default=None, description="ISO date, e.g. 2026-06-01"),
    end_date: Optional[str]   = Query(default=None, description="ISO date, e.g. 2026-06-30"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    
    gateway = db.query(Gateway).filter(Gateway.gateway_id == gateway_id).first()
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway tidak ditemukan")

    query = db.query(TelemetryLog).filter(TelemetryLog.gateway_id == gateway_id)

    if start_date:
        start_dt = WIB.localize(datetime.strptime(f"{start_date} 00:00:00", "%Y-%m-%d %H:%M:%S"))
        query = query.filter(TelemetryLog.created_at >= start_dt)
    if end_date:
        end_dt = WIB.localize(datetime.strptime(f"{end_date} 23:59:59", "%Y-%m-%d %H:%M:%S"))
        query = query.filter(TelemetryLog.created_at <= end_dt)

    total = query.count()
    
    if start_date:
        order_clause = TelemetryLog.created_at.asc()
    else:
        order_clause = TelemetryLog.created_at.desc()
        
    logs = (
        query
        .order_by(order_clause)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "status": "success",
        "data": {
            "logs": [
                {
                    "id": l.id,
                    "created_at": l.created_at.isoformat() if l.created_at else None,
                    "payload": l.payload,
                    "gateway_id": l.gateway_id,
                }
                for l in logs
            ],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_records": total,
                "total_pages": (total + page_size - 1) // page_size,
            }
        }
    }


@router.put("/{gateway_id}")
def update_gateway(gateway_id: int, payload: GatewaySchema, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    if role not in ["admin", "rasindo_operator"]:
        raise HTTPException(status_code=403, detail="Akses ditolak!")
    gateway = db.query(Gateway).filter(Gateway.gateway_id == gateway_id).first()
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway tidak ditemukan")
    try:
        gateway.hmi_code = payload.hmi_code
        gateway.name = payload.name
        gateway.project_id = payload.project_id
        gateway.status = payload.status
        gateway.config = payload.config
        db.commit()
        return {"status": "success", "message": "Gateway berhasil diperbarui"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{gateway_id}")
def delete_gateway(gateway_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    if role not in ["admin", "rasindo_operator"]:
        raise HTTPException(status_code=403, detail="Akses ditolak!")
    gateway = db.query(Gateway).filter(Gateway.gateway_id == gateway_id).first()
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway tidak ditemukan")
    try:
        db.delete(gateway)
        db.commit()
        return {"status": "success", "message": "Gateway berhasil dihapus"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))