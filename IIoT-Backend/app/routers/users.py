import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models import User, PasswordReset
from typing import List, Optional, Literal
from passlib.context import CryptContext
from app.routers.auth import get_current_user, require_role

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(prefix="/api/users", tags=["Users Management"])

class UserResponseSchema(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    company_id: int
    is_approved: bool

    class Config:
        from_attributes = True

class UserUpdateSchema(BaseModel):
    name: str
    role: Literal["admin", "rasindo_operator", "rasindo_user", "client_operator", "client_user"]
    company_id: int
    is_approved: bool

class UserSubmitNewPasswordSchema(BaseModel):
    token: str
    new_password: str

# ========================================================
# 1. GET — perlu login, list di-scope company kecuali admin/operator
# ========================================================
@router.get("/")
def get_users(
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        # Non-admin/operator cuma boleh lihat user di company sendiri,
        # walau mereka coba kirim company_id lain lewat query param.
        if current_user["role"] not in ("admin", "rasindo_operator", "rasindo_user"):
            company_id = current_user["company_id"]

        if company_id:
            users_db = db.query(User).filter(User.company_id == company_id).all()
        else:
            users_db = db.query(User).all()

        formatted_users = []
        for u in users_db:
            formatted_users.append({
                "id": u.id,
                "name": u.name if hasattr(u, 'name') else getattr(u, 'username', 'Unknown'),
                "email": u.email,
                "role": u.role,
                "company_id": u.company_id,
                "is_approved": u.is_approved
            })

        return {"status": "success", "data": formatted_users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eror DB: {str(e)}")

# ========================================================
# 2. PUT — HANYA admin/operator boleh ubah role, company_id, approval
# ========================================================
@router.put("/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdateSchema,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "rasindo_operator")),
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan!")

    try:
        if hasattr(db_user, 'name'):
            db_user.name = payload.name
        elif hasattr(db_user, 'username'):
            db_user.username = payload.name

        db_user.role = payload.role
        db_user.company_id = payload.company_id
        db_user.is_approved = payload.is_approved

        db.commit()
        return {"status": "success", "message": "Berhasil diperbarui!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ========================================================
# 3. POST (ADMIN): Generate reset token — HANYA admin/operator
# ========================================================
@router.post("/generate-reset-token/{user_id}")
def generate_reset_token(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "rasindo_operator")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Operator tidak ditemukan di database")

    secure_token = str(uuid.uuid4())
    expiration_time = datetime.now(timezone.utc) + timedelta(minutes=15)

    new_reset = PasswordReset(
        email=user.email,
        token=secure_token,
        expires_at=expiration_time,
        is_used=False
    )

    try:
        db.add(new_reset)
        db.commit()
        target_link = f"http://localhost:3000/reset-password?token={secure_token}"
        return {"status": "success", "reset_link": target_link}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal generate token log: {str(e)}")

# ========================================================
# 4. POST (USER): Execute reset password — TETAP PUBLIK
# Sengaja tidak diproteksi Depends(get_current_user), karena user yang
# lupa password justru TIDAK PUNYA sesi login. Keamanannya ada di
# validitas & masa berlaku token itu sendiri (15 menit, sekali pakai),
# bukan di status login. Sama seperti /api/auth/reset-password.
# ========================================================
@router.post("/execute-reset-password")
def execute_reset_password(payload: UserSubmitNewPasswordSchema, db: Session = Depends(get_db)):
    reset_record = db.query(PasswordReset).filter(
        PasswordReset.token == payload.token,
        PasswordReset.is_used == False
    ).first()

    if not reset_record:
        raise HTTPException(status_code=400, detail="Tautan tidak sah atau sudah kedaluwarsa!")

    now = datetime.now(timezone.utc)
    if reset_record.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=400, detail="Durasi link 15 menit sudah habis! Minta link baru ke Admin.")

    user = db.query(User).filter(User.email == reset_record.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Akun terikat token ini sudah dihapus.")

    try:
        user.password = pwd_context.hash(payload.new_password)
        reset_record.is_used = True
        db.commit()
        return {"status": "success", "message": "Password baru berhasil dipasang! Silakan login kembali."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal mutasi database: {str(e)}")