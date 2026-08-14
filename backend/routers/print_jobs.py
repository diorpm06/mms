from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_utils import require_doctor_or_admin_or_ceo
from config import settings
from database import get_db
from models.print_job import PrintJob
from models.user import User

router = APIRouter(prefix="/api/print-jobs", tags=["print-jobs"])

# Rol -> qaysi joydagi agent chop etishi kerak. Kerak bo'lsa keyinchalik
# har bir foydalanuvchi uchun alohida sozlanadigan qilinishi mumkin.
ROLE_LOCATION = {
    "admin": "admin_main",
    "doctor": "admin_main",
    "ceo": "ceo_home",
}
DEFAULT_LOCATION = "admin_main"


class PrintJobCreate(BaseModel):
    title: str
    content: str
    printer_type: Optional[str] = "a4"  # a4 | receipt


def _verify_agent(x_agent_token: str | None):
    if not settings.PRINT_AGENT_TOKEN or x_agent_token != settings.PRINT_AGENT_TOKEN:
        raise HTTPException(status_code=403, detail="Agent token noto'g'ri")


def _row(j: PrintJob) -> dict:
    return {
        "id": j.id,
        "location_key": j.location_key,
        "printer_type": j.printer_type,
        "title": j.title,
        "content": j.content,
        "status": j.status,
        "created_by_name": j.created_by_name,
        "printed_at": j.printed_at.isoformat() if j.printed_at else None,
        "created_at": j.created_at.isoformat() if j.created_at else None,
    }


@router.post("")
def create_print_job(
    body: PrintJobCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    location_key = ROLE_LOCATION.get(user.role, DEFAULT_LOCATION)
    j = PrintJob(
        location_key=location_key,
        printer_type=body.printer_type or "a4",
        title=body.title,
        content=body.content,
        created_by=user.id,
        created_by_name=user.full_name,
        status="pending",
    )
    db.add(j)
    db.commit()
    db.refresh(j)
    return {"message": "Chop etish navbatiga qo'shildi", "id": j.id, "location_key": location_key}


@router.get("/pending")
def list_pending_print_jobs(
    location_key: str,
    db: Session = Depends(get_db),
    x_agent_token: str | None = Header(None),
):
    _verify_agent(x_agent_token)
    rows = (
        db.query(PrintJob)
        .filter(PrintJob.location_key == location_key, PrintJob.status == "pending")
        .order_by(PrintJob.created_at.asc())
        .all()
    )
    return [_row(j) for j in rows]


@router.patch("/{job_id}/mark-printed")
def mark_print_job_printed(
    job_id: int,
    db: Session = Depends(get_db),
    x_agent_token: str | None = Header(None),
):
    _verify_agent(x_agent_token)
    j = db.query(PrintJob).filter(PrintJob.id == job_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Topilmadi")
    j.status = "printed"
    j.printed_at = datetime.utcnow()
    db.commit()
    return {"message": "OK"}


@router.get("/my-recent")
def my_recent_print_jobs(
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    """Foydalanuvchi o'zi yuborgan so'nggi chop etish buyruqlari holatini ko'rishi uchun."""
    rows = (
        db.query(PrintJob)
        .filter(PrintJob.created_by == user.id)
        .order_by(PrintJob.created_at.desc())
        .limit(20)
        .all()
    )
    return [_row(j) for j in rows]
