from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
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


def _row(b: Banner) -> dict:
    """image_data javobga qo'shilmaydi (og'ir) — o'rniga havola beriladi."""
    return {
        "id": b.id,
        "title": b.title,
        "image_url": f"/api/banners/{b.id}/image" if b.image_data else b.image_url,
        # Yangi havolada fayl kengaytmasi yo'q, shuning uchun TV ekran video
        # ekanini shu maydon orqali aniqlaydi (aks holda video <img> ga tushib
        # qolardi).
        "content_type": b.content_type,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


@router.get("")
def get_banners(db: Session = Depends(get_db)):
    """TV ekrani uchun barcha faol banner reklamalar ro'yxatini olish."""
    rows = db.query(Banner).order_by(Banner.created_at.desc()).all()
    return [_row(b) for b in rows]


@router.get("/{banner_id}/image")
def get_banner_image(banner_id: int, db: Session = Depends(get_db)):
    """Rasmni bazadan uzatadi. TV ekrani ochiq bo'lgani uchun autentifikatsiyasiz."""
    b = db.query(Banner).filter(Banner.id == banner_id).first()
    if not b or not b.image_data:
        raise HTTPException(status_code=404, detail="Rasm topilmadi")
    return Response(
        content=b.image_data,
        media_type=b.content_type or "image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


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
    """Admin panel orqali rasm faylini yuklash — rasm bazaga saqlanadi."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Fayl bo'sh")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Rasm hajmi 5 MB dan oshmasligi kerak")

    banner = Banner(
        title=title or file.filename,
        image_url="",  # quyida haqiqiy havola bilan almashtiriladi
        image_data=content,
        content_type=file.content_type or "image/jpeg",
    )
    db.add(banner)
    db.flush()
    banner.image_url = f"/api/banners/{banner.id}/image"
    db.commit()
    db.refresh(banner)
    return _row(banner)


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
