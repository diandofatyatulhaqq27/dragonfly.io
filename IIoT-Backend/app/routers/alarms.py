from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.database import get_db
from app.models import Alarm, AlarmHistory
from app.routers.auth import get_current_user, require_role

router = APIRouter(prefix="/api/alarms", tags=["Alarms"])


class AlarmCreateSchema(BaseModel):
    gateway_id: int
    mqtt_key: str
    name: str
    message: str


class AlarmUpdateSchema(BaseModel):
    gateway_id: int
    mqtt_key: str
    name: str
    message: str
    severity: Optional[str] = "ACTIVE"
    status: Optional[str] = "ACTIVE"


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_or_update_alarm(
    payload: AlarmCreateSchema,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "rasindo_operator")),
):
    try:
        existing_alarm = db.query(Alarm).filter(
            Alarm.gateway_id == payload.gateway_id,
            Alarm.mqtt_key == payload.mqtt_key
        ).first()

        if existing_alarm:
            existing_alarm.name = payload.name.strip()
            existing_alarm.message = payload.message.strip()
            db.commit()
            db.refresh(existing_alarm)
            return {"status": "success", "message": "Konfigurasi alarm berhasil diperbarui", "data": existing_alarm}
        else:
            new_alarm = Alarm(
                gateway_id=payload.gateway_id,
                mqtt_key=payload.mqtt_key.strip(),
                name=payload.name.strip(),
                message=payload.message.strip(),
                severity="NORMAL",
                status="RESOLVED"
            )
            db.add(new_alarm)
            db.commit()
            db.refresh(new_alarm)
            return {"status": "success", "message": "Master konfigurasi alarm berhasil didaftarkan", "data": new_alarm}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal memproses data alarm ke database: {str(e)}")


@router.put("/{alarm_id}")
def update_alarm(
    alarm_id: int,
    payload: AlarmUpdateSchema,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        db_alarm = db.query(Alarm).filter(Alarm.id == alarm_id).first()
        if not db_alarm:
            raise HTTPException(status_code=404, detail="Alarm tidak ditemukan.")

        db_alarm.gateway_id = payload.gateway_id
        db_alarm.mqtt_key = payload.mqtt_key.strip()
        db_alarm.name = payload.name.strip()
        db_alarm.message = payload.message.strip()
        db_alarm.severity = payload.severity or db_alarm.severity
        db_alarm.status = payload.status or db_alarm.status

        if payload.status == "RESOLVED":
            last_history = (
                db.query(AlarmHistory)
                .filter(
                    AlarmHistory.alarm_id == alarm_id,
                    AlarmHistory.verified_at == None
                )
                .order_by(AlarmHistory.triggered_at.desc())
                .first()
            )
            if last_history:
                last_history.verified_at = func.now()
                last_history.verified_by = current_user.get("email") or current_user.get("name") or "unknown"

        db.commit()
        db.refresh(db_alarm)
        return {"status": "success", "message": "Alarm berhasil diperbarui", "data": db_alarm}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal memperbarui alarm: {str(e)}")


@router.get("/")
def get_all_alarms(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        all_alarms = db.query(Alarm).order_by(Alarm.created_at.desc()).all()
        return {"status": "success", "data": all_alarms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memuat data alarm: {str(e)}")


@router.get("/recent")
def get_recent_alarms(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        recent_alarms = db.query(Alarm).order_by(Alarm.created_at.desc()).limit(limit).all()
        return {"status": "success", "data": recent_alarms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memuat log alarm dari database: {str(e)}")


@router.get("/history")
def get_alarm_history(
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        history = (
            db.query(AlarmHistory)
            .order_by(AlarmHistory.triggered_at.desc())
            .limit(limit)
            .all()
        )
        return {"status": "success", "data": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memuat history alarm: {str(e)}")


@router.delete("/{alarm_id}")
def delete_master_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "rasindo_operator")),
):
    try:
        db_alarm = db.query(Alarm).filter(Alarm.id == alarm_id).first()
        if not db_alarm:
            raise HTTPException(status_code=404, detail="Master alarm tidak ditemukan.")
        db.delete(db_alarm)
        db.commit()
        return {"status": "success", "message": "Master konfigurasi alarm berhasil dihapus."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))