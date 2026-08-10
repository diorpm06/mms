from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid
import os

from database import get_db
from auth_utils import require_admin_or_ceo
from models.banner import Banner
from models.user import User

router = APIRouter(prefix="/api/banners", tags=["banners"])

UPLOAD_DIR = "/tmp/uploads" if os.environ.get("VERCEL") else os.path.join(os.getcwd(), "uploads")
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except Exception:
    pass


class BannerCreate(BaseModel):
    title: Optional[str] = None
    image_url: str


@router.get("")
def get_banners(db: Session = Depends(get_db)):
    """TV ekrani uchun barcha faol banner reklamalar ro'yxatini olish."""
    return db.query(Banner).order_by(Banner.created_at.desc()).all()


@router.post("")
def create_banner_url(
    data: BannerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    """URL orqali rasm reklama qo'shish."""
    banner = Banner(title=data.title, image_url=data.image_url)
    db.add(banner)
    db.commit()
    db.refresh(banner)
    return banner


@router.post("/upload")
async def upload_banner_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    """Admin panel orqali rasm faylini yuklash."""
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"banner_{uuid.uuid4().hex[:10]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    image_url = f"/uploads/{filename}"
    banner = Banner(title=title or file.filename, image_url=image_url)
    db.add(banner)
    db.commit()
    db.refresh(banner)
    return banner


@router.delete("/{banner_id}")
def delete_banner(
    banner_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    """Reklamani o'chirish."""
    b = db.query(Banner).filter(Banner.id == banner_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Reklama topilmadi")
    db.delete(b)
    db.commit()
    return {"message": "Reklama o'chirildi"}
