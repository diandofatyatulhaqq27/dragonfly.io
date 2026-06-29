from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.database import get_db
from app.models import Gateway, Project, TelemetryLog
from app.routers.auth import get_current_user
from typing import Optional, List, Any
from sqlalchemy import text

router = APIRouter(prefix="/api/gateways", tags=["Gateways"])

class GatewaySchema(BaseModel):
    gateway_id: Optional[int] = None
    hmi_code: Optional[str] = None
    name: str
    project_id: Optional[int] = None
    status: Optional[str] = "offline"
    config: Optional[List[Any]] = []

    class Config:
        from_attributes = True

RANGE_CONFIG = {
    "1h":  {"interval": "NOW() - INTERVAL '1 hour'",   "bucket_secs": 60},    # per 1 menit
    "6h":  {"interval": "NOW() - INTERVAL '6 hours'",  "bucket_secs": 3600},  # per 1 jam
    "24h": {"interval": "NOW() - INTERVAL '24 hours'", "bucket_secs": 3600},  # per 1 jam
    "7d":  {"interval": "NOW() - INTERVAL '7 days'",   "bucket_secs": 86400}, # per 1 hari
    "30d": {"interval": "NOW() - INTERVAL '30 days'",  "bucket_secs": 86400}, # per 1 hari
}

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

@router.get("/{gateway_id}/chart")
def get_gateway_chart(
    gateway_id: int,
    range: str = "1h",
    keys: str = "",
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    gateway = db.query(Gateway).filter(Gateway.gateway_id == gateway_id).first()
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway tidak ditemukan")

    cfg = RANGE_CONFIG.get(range, RANGE_CONFIG["1h"])
    cutoff_expr = cfg["interval"]
    bucket_secs = cfg["bucket_secs"]

    key_list = [k.strip() for k in keys.split(",") if k.strip()] if keys else []
    if not key_list:
        return {"status": "success", "data": []}

    try:
        # Buat klausa SELECT rata-rata dinamis untuk setiap key JSON payload
        select_parts = ", ".join([
            f"AVG((payload->>'{k}')::float) AS \"{k}\""
            for k in key_list
        ])

        # Query matematika bucket interval waktu (Time-bucketing di PostgreSQL)
        sql = text(f"""
            SELECT
                date_trunc('minute', created_at) 
                    + (FLOOR(EXTRACT(EPOCH FROM (created_at - date_trunc('minute', created_at))) / :bucket_secs) * :bucket_secs || ' seconds')::interval AS bucket,
                {select_parts}
            FROM telemetry_logs
            WHERE gateway_id = :gateway_id
              AND created_at >= {cutoff_expr}
            GROUP BY bucket
            ORDER BY bucket ASC
        """)

        rows = db.execute(sql, {
            "gateway_id": gateway_id,
            "bucket_secs": bucket_secs,
        }).fetchall()

        result = []
        for row in rows:
            # row[0] adalah waktu bucket, row[1:] adalah nilai dari keys
            point = {"time": row[0].isoformat() if row[0] else None}
            for i, k in enumerate(key_list):
                val = row[i + 1]
                point[k] = round(float(val), 4) if val is not None else None
            result.append(point)

        return {"status": "success", "data": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database aggregation error: {str(e)}")

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
        gateway.config = payload.config if payload.config is not None else []
        flag_modified(gateway, "config")
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