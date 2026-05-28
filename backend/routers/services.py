from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth_utils import require_admin_or_ceo, require_ceo
from database import get_db
from models.service import Service
from models.user import User
from schemas import ServiceCreate, ServiceOut, ServiceUpdate

router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("", response_model=list[ServiceOut])
def list_services(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    return db.query(Service).filter(Service.is_active == True).order_by(Service.name).all()


@router.get("/all", response_model=list[ServiceOut])
def list_all_services(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    return db.query(Service).order_by(Service.name).all()


@router.post("", response_model=ServiceOut)
def create_service(data: ServiceCreate, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    s = Service(**data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/{service_id}", response_model=ServiceOut)
def update_service(
    service_id: int, data: ServiceUpdate, db: Session = Depends(get_db), _: User = Depends(require_ceo)
):
    s = db.query(Service).filter(Service.id == service_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Xizmat topilmadi")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    s = db.query(Service).filter(Service.id == service_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Xizmat topilmadi")
    s.is_active = False
    db.commit()
    return {"message": "O'chirildi"}
