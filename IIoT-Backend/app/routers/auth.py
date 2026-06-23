import os
import secrets
from datetime import datetime, timedelta
from fastapi import BackgroundTasks
from app.models import PasswordReset
from app.email_service import send_reset_email
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Company
from passlib.context import CryptContext
from typing import Optional

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class RegisterSchema(BaseModel):
    name: str
    email: EmailStr
    password: str
    invitation_code: str = Field(..., alias="invitationCode") 

    class Config:
        populate_by_name = True 

class LoginSchema(BaseModel):
    email: EmailStr
    password: str

# ========================================================
# 🌟 LOGIKA UTAMA DEPENDENCY: get_current_user (Fixed Multi-Channel Authentication)
# ========================================================
def get_current_user(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Fungsi ini mengamankan endpoint dengan membaca identitas user.
    Mendukung pengecekan via Header 'X-User-Id' ataupun Bearer Token.
    """
    target_id = None

    # 1. Cek jika Next.js mengirimkan identitas langsung via X-User-Id header
    if x_user_id:
        target_id = x_user_id
    
    # 2. Cek jika Next.js mengirimkan data via Authorization Header (Bearer <id>)
    elif authorization and authorization.startswith("Bearer "):
        token_value = authorization.split(" ")[1]
        # Jika token murni berisi string ID user (karena belum implementasi JWT penuh)
        if token_value.isdigit():
            target_id = token_value

    # Jika semua jalur kosong, kunci akses ditolak mentah-mentah
    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Sesi login tidak terdeteksi. Silakan login kembali."
        )
    
    try:
        user = db.query(User).filter(User.id == int(target_id)).first()
    except ValueError:
        raise HTTPException(status_code=401, detail="Format token/identitas sesi tidak valid.")

    if not user:
        raise HTTPException(status_code=401, detail="Sesi user tidak terdaftar atau tidak valid.")
        
    # Mengembalikan dict data identitas lengkap user untuk dibaca oleh router lain (seperti projects.py)
    return {
        "id": user.id,
        "name": user.name,
        "role": user.role,       # admin, rasindo_operator, rasindo_user, atau client_user
        "company_id": user.company_id
    }

# ========================================================
# 1. ENDPOINT REGISTER (FIXED DEFAULT ROLE)
# ========================================================
@router.post("/register")
def register(user: RegisterSchema, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.invitation_code.ilike(user.invitation_code)).first()
    if not company:
        raise HTTPException(status_code=400, detail="Invitation Code tidak valid!")
        
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar di sistem!")

    hashed_password = pwd_context.hash(user.password)

    db_user = User(
        name=user.name,
        email=user.email,
        password=hashed_password, 
        role="client_user", # 🌟 FIX: Ubah default kasta dari 'user' menjadi 'client_user'
        company_id=company.id,
        is_approved=False
    )
    
    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return {"status": "success", "message": "User berhasil didaftarkan! Tunggu persetujuan Admin."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan user: {str(e)}")

# ========================================================
# 2. ENDPOINT LOGIN
# ========================================================
@router.post("/login")
def login(payload: LoginSchema, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Email atau Password salah.")
    
    if not pwd_context.verify(payload.password, user.password):
        raise HTTPException(status_code=401, detail="Email atau Password salah.")
        
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Akun Anda belum aktif. Silakan hubungi Admin.")
        
    return {
        "status": "success",
        "access_token": str(user.id),  # ← tambahkan ini
        "user": {
            "id": user.id,
            "name": user.name,
            "role": user.role,
            "company_id": user.company_id
        }
    }

@router.get("/seed-admin")
def seed_admin(secret: str, db: Session = Depends(get_db)):
    if secret != os.getenv("SEED_SECRET"):
        raise HTTPException(status_code=403, detail="Secret salah")

    existing = db.query(User).filter(User.email == "admin@iiot.com").first()
    if existing:
        return {"status": "sudah ada", "email": existing.email}

    company = db.query(Company).first()
    if not company:
        company = Company(name="Default Company", invitation_code="ADMIN2026")
        db.add(company)
        db.commit()
        db.refresh(company)

    hashed = pwd_context.hash("Admin123!")
    admin_user = User(
        name="Administrator",
        email="admin@iiot.com",
        password=hashed,
        role="admin",
        company_id=company.id,
        is_approved=True
    )
    db.add(admin_user)
    db.commit()

    return {
        "status": "success",
        "email": "admin@iiot.com",
        "password": "Admin123!",
        "invitation_code": company.invitation_code
    }
    
# ========================================================
# 3. ENDPOINT FORGOT PASSWORD (user request via email)
# ========================================================
class ForgotPasswordSchema(BaseModel):
    email: EmailStr

@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordSchema,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.email).first()

    # Selalu return success meski email tidak ada
    # (security: jangan bocorkan apakah email terdaftar atau tidak)
    if not user:
        return {"status": "success", "message": "If this email is registered, a reset link has been sent."}

    # Hapus token lama kalau ada
    db.query(PasswordReset).filter(PasswordReset.email == payload.email).delete()
    db.commit()

    # Generate token baru
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    db_reset = PasswordReset(
        email=payload.email,
        token=token,
        expires_at=expires_at,
        is_used=False
    )
    db.add(db_reset)
    db.commit()

    # Build reset link
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    reset_link = f"{frontend_url}/reset-password?token={token}"

    # Kirim email di background (tidak block response)
    background_tasks.add_task(send_reset_email, payload.email, reset_link)

    return {"status": "success", "message": "If this email is registered, a reset link has been sent."}


# ========================================================
# 4. ENDPOINT EXECUTE RESET PASSWORD (pakai token dari email)
# ========================================================
class ResetPasswordSchema(BaseModel):
    token: str
    new_password: str

@router.post("/reset-password")
def reset_password(payload: ResetPasswordSchema, db: Session = Depends(get_db)):
    db_reset = db.query(PasswordReset).filter(
        PasswordReset.token == payload.token,
        PasswordReset.is_used == False
    ).first()

    if not db_reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    if datetime.utcnow() > db_reset.expires_at:
        db.delete(db_reset)
        db.commit()
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")

    user = db.query(User).filter(User.email == db_reset.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password = pwd_context.hash(payload.new_password)
    db_reset.is_used = True

    db.commit()
    return {"status": "success", "message": "Password updated successfully."}