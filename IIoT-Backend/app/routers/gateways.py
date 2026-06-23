from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Gateway, Project, TelemetryLog
from app.routers.auth import get_current_user
from typing import Optional, List, Any

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
        .order_by(TelemetryLog.created_at.asc())
        .limit(1000)
        .all()
    )

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
                for l in logs
            ]
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