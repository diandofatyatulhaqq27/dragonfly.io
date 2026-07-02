from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Company
from app.routers.auth import require_role

router = APIRouter(prefix="/api/companies", tags=["Companies (Tenants)"])

class CompanySchema(BaseModel):
    name: str
    address: str
    invitation_code: str

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_company(
    company: CompanySchema,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    db_company = Company(name=company.name, address=company.address, invitation_code=company.invitation_code)
    try:
        db.add(db_company)
        db.commit()
        db.refresh(db_company)
        return {"status": "success", "data": db_company}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/")
def get_companies(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "rasindo_operator")),
):
    try:
        companies = db.query(Company).all()
        return {"status": "success", "data": companies}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memuat company: {str(e)}")

@router.put("/{company_id}")
def update_company(
    company_id: int,
    payload: CompanySchema,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Perusahaan tidak ditemukan")
    company.name = payload.name
    company.address = payload.address
    company.invitation_code = payload.invitation_code
    db.commit()
    return {"status": "success", "message": "Data perusahaan berhasil diperbarui"}

@router.delete("/{company_id}")
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Perusahaan tidak ditemukan")
    db.delete(company)
    db.commit()
    return {"status": "success", "message": "Perusahaan berhasil dihapus"}