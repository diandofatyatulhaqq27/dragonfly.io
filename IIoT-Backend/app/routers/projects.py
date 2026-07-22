from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload  # 🌟 Tambahkan joinedload di sini
from app.database import get_db
from app.models import Project, TelemetryLog, Gateway
from typing import Optional, List, Any
from app.routers.auth import get_current_user 

router = APIRouter(prefix="/api/projects", tags=["Projects"])

class ProjectSchema(BaseModel):
    project_id: Optional[int] = None
    display_name: str
    company_id: int
    description: Optional[str] = ""   
    latitude: float
    longitude: float
    config: Optional[List[Any]] = []  

    class Config:
        from_attributes = True

# ==============================================================================
# 1. ENDPOINT POST: Membuat Project Baru
# ==============================================================================
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_project(
    project: ProjectSchema, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    role = current_user.get("role")
    
    if role not in ["admin", "rasindo_operator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Tindakan ditolak! Hanya Administrator & Rasindo Operator."
        )

    db_project = Project(
        display_name=project.display_name,
        description=project.description,
        company_id=project.company_id,
        latitude=project.latitude,    
        longitude=project.longitude,
        config=project.config  
    )
    try:
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        return {"status": "success", "data": db_project}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan ke PostgreSQL: {str(e)}")

# ==============================================================================
# 2. ENDPOINT GET ALL (Ditambahkan joinedload gateways untuk kebutuhan AssetMap)
# ==============================================================================
@router.get("/")
def get_projects(
    company_id: Optional[int] = None, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        role = current_user.get("role")
        user_company_id = current_user.get("company_id")

        # Menggunakan .options(joinedload(Project.gateways)) agar relasi ke-load ke JSON frontend 🔒
        if role in ["client_operator", "client_user"]:
            projects = db.query(Project)\
                         .options(joinedload(Project.gateways))\
                         .filter(Project.company_id == user_company_id)\
                         .all()
            return {"status": "success", "data": projects}

        if company_id:
            projects = db.query(Project)\
                         .options(joinedload(Project.gateways))\
                         .filter(Project.company_id == company_id)\
                         .all()
        else:
            projects = db.query(Project)\
                         .options(joinedload(Project.gateways))\
                         .all()
            
        return {"status": "success", "data": projects}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==============================================================================
# 3. ENDPOINT GET SINGLE DETAIL (Diformat ulang agar membawa array "gateways")
# ==============================================================================
@router.get("/{project_id}")
def get_project_detail(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # Ikut sertakan relasi gateways saat fetch single detail 🔒
    project = db.query(Project)\
                .options(joinedload(Project.gateways))\
                .filter(Project.project_id == project_id)\
                .first()
                
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak terdaftar")

    role = current_user.get("role")
    user_company_id = current_user.get("company_id")

    if role in ["client_operator", "client_user"] and project.company_id != user_company_id:
        raise HTTPException(status_code=403, detail="Akses ilegal!")

    try:
        logs = db.query(TelemetryLog)\
                 .join(Gateway, TelemetryLog.gateway_id == Gateway.gateway_id)\
                 .filter(Gateway.project_id == project_id)\
                 .order_by(TelemetryLog.created_at.desc())\
                 .limit(1000)\
                 .all()

        formatted_data = {
            "project_id": project.project_id,
            "display_name": project.display_name,
            "description": project.description,
            "company_id": project.company_id,
            "latitude": project.latitude,
            "longitude": project.longitude,
            "config": project.config,
            # 🌟 JAHIT ARRAY GATEWAYS DI SINI: untuk dibaca oleh auto-redirect Next.js
            "gateways": [
                {
                    "gateway_id": gw.gateway_id,
                    "name": gw.name,
                    "status": gw.status,
                    "hmi_code": gw.hmi_code
                } for gw in project.gateways
            ],
            "logs": [{"id": log.id, "gateway_id": log.gateway_id, "payload": log.payload, "created_at": log.created_at.isoformat() if log.created_at else None} for log in logs]
        }
        return {"status": "success", "data": formatted_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==============================================================================
# 4. ENDPOINT PUT
# ==============================================================================
@router.put("/{project_id}")
def update_project(
    project_id: int, 
    payload: ProjectSchema, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    role = current_user.get("role")
    # 🔒 client_operator TIDAK boleh edit project — role ini hanya berhak
    # acknowledge/resolve alarm (lihat alarms.py). Edit project tetap
    # eksklusif admin & rasindo_operator (internal Rasindo).
    if role not in ["admin", "rasindo_operator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tindakan ditolak! Hanya Administrator & Rasindo Operator."
        )

    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan")

    try:
        project.display_name = payload.display_name
        project.description = payload.description
        project.company_id = payload.company_id
        project.latitude = payload.latitude
        project.longitude = payload.longitude
        project.config = payload.config  
        db.commit()
        return {"status": "success", "message": "Berhasil diperbarui"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ==============================================================================
# 5. ENDPOINT DELETE
# ==============================================================================
@router.delete("/{project_id}")
def delete_project(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    role = current_user.get("role")
    if role not in ["admin", "rasindo_operator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tindakan ditolak! Hanya Administrator & Rasindo Operator."
        )

    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan")
    
    try:
        db.delete(project)
        db.commit()
        return {"status": "success", "message": "Project berhasil dihapus"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))