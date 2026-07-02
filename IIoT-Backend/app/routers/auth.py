import os
import secrets
from datetime import datetime, timedelta, timezone
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
from jose import jwt, JWTError

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ========================================================
# 🌟 JWT CONFIG
# ========================================================
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    # Jangan biarkan server start tanpa SECRET_KEY — daripada diam-diam
    # fallback ke nilai lemah yang bikin token bisa dipalsukan.
    raise RuntimeError(
        "SECRET_KEY belum di-set di environment. "
        "Set SECRET_KEY di .env sebelum menjalankan server."
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 hari, sesuaikan kebutuhan


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except (JWTError, ValueError):
        return None


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
# 🌟 LOGIKA UTAMA DEPENDENCY: get_current_user (JWT-based)
# ========================================================
def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Mengamankan endpoint dengan memverifikasi JWT yang dikirim lewat
    header Authorization: Bearer <token>. Token HARUS ditandatangani
    dengan SECRET_KEY server — tidak bisa dipalsukan hanya dengan
    menebak ID user.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesi login tidak terdeteksi. Silakan login kembali."
        )

    token = authorization.split(" ", 1)[1]
    user_id = decode_access_token(token)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau sudah kedaluwarsa. Silakan login kembali."
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=401, detail="Sesi user tidak terdaftar atau tidak valid.")

    return {
        "id": user.id,
        "name": user.name,
        "role": user.role,
        "company_id": user.company_id
    }
    
def require_role(*allowed_roles: str):
    """
    Dependency generator untuk membatasi endpoint ke role tertentu.
    Contoh: Depends(require_role("admin"))
            Depends(require_role("admin", "rasindo_operator"))
    """
    def checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Anda tidak memiliki izin untuk melakukan aksi ini."
            )
        return current_user
    return checker

# ========================================================
# 1. ENDPOINT REGISTER
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
        role="client_user",
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
# 2. ENDPOINT LOGIN (sekarang mengeluarkan JWT signed, bukan ID mentah)
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

    access_token = create_access_token(user.id)

    return {
        "status": "success",
        "access_token": access_token,
        "user": {
            "id": user.id,
            "name": user.name,
            "role": user.role,
            "company_id": user.company_id
        }
    }


# ========================================================
# 3. ENDPOINT FORGOT PASSWORD — tidak ada perubahan
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

    if not user:
        return {"status": "success", "message": "If this email is registered, a reset link has been sent."}

    db.query(PasswordReset).filter(PasswordReset.email == payload.email).delete()
    db.commit()

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    db_reset = PasswordReset(
        email=payload.email,
        token=token,
        expires_at=expires_at,
        is_used=False
    )
    db.add(db_reset)
    db.commit()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    reset_link = f"{frontend_url}/reset-password?token={token}"

    background_tasks.add_task(send_reset_email, payload.email, reset_link)

    return {"status": "success", "message": "If this email is registered, a reset link has been sent."}


# ========================================================
# 4. ENDPOINT EXECUTE RESET PASSWORD — tidak ada perubahan
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

    now = datetime.now(timezone.utc)
    expires_at = db_reset.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now > expires_at:
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