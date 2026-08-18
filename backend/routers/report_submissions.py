from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from auth_utils import require_admin_or_ceo, require_doctor_or_admin_or_ceo
from database import get_db
from models.patient import Patient
from models.report_submission import ReportSubmission
from models.user import User
from services.audit import get_client_info, log_audit

router = APIRouter(prefix="/api/report-submissions", tags=["report-submissions"])


class ReportSubmissionCreate(BaseModel):
    patient_id: int
    service_id: Optional[int] = None
    template_key: str
    template_label: str
    category: str
    content: str


def _row(r: ReportSubmission) -> dict:
    return {
        "id": r.id,
        "patient_id": r.patient_id,
        "patient_name": f"{r.patient.first_name} {r.patient.last_name}" if r.patient else None,
        "ticket_number": r.patient.ticket_number if r.patient else None,
        "service_id": r.service_id,
        "template_key": r.template_key,
        "template_label": r.template_label,
        "category": r.category,
        "content": r.filled_data or "",
        "doctor_name": r.doctor_name,
        "status": r.status,
        "printed_at": r.printed_at.isoformat() if r.printed_at else None,
        "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.post("")
def create_report_submission(
    body: ReportSubmissionCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")

    r = ReportSubmission(
        patient_id=body.patient_id,
        service_id=body.service_id,
        template_key=body.template_key,
        template_label=body.template_label,
        category=body.category,
        filled_data=body.content,
        doctor_id=user.id,
        doctor_name=user.full_name,
        # Saqlash va yuborish ajratilgan: shifokor avval to'ldirib saqlaydi
        # (qoralama), keyin bir necha natijani birdaniga adminga yuboradi.
        status="draft",
    )
    db.add(r)
    db.flush()

    ip, ua = get_client_info(request)
    log_audit(
        db,
        user_id=user.id,
        user_role=user.role,
        action_type="REPORT_SAVED",
        table_name="report_submissions",
        record_id=r.id,
        detail_message=f"{user.full_name}: {body.template_label} — {patient.first_name} {patient.last_name}",
        ip_address=ip,
        device_info=ua,
    )
    db.commit()
    db.refresh(r)
    return {"message": "Natija saqlandi", "id": r.id}


class YuborishBody(BaseModel):
    ids: Optional[list[int]] = None   # bo'sh bo'lsa — barcha qoralamalar


@router.get("/my-drafts")
def list_my_drafts(
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    """Shifokor saqlagan, lekin hali yuborilmagan natijalar."""
    rows = (
        db.query(ReportSubmission)
        .options(joinedload(ReportSubmission.patient))
        .filter(
            ReportSubmission.status == "draft",
            ReportSubmission.doctor_id == user.id,
        )
        .order_by(ReportSubmission.created_at.desc())
        .all()
    )
    return [_row(r) for r in rows]


@router.post("/submit")
def submit_drafts(
    body: YuborishBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    """Saqlangan natijalarni adminga yuboradi (bir nechtasini birdaniga)."""
    q = db.query(ReportSubmission).filter(
        ReportSubmission.status == "draft",
        ReportSubmission.doctor_id == user.id,
    )
    if body.ids:
        q = q.filter(ReportSubmission.id.in_(body.ids))
    rows = q.all()
    if not rows:
        raise HTTPException(status_code=400, detail="Yuboriladigan saqlangan natija yo'q")

    hozir = datetime.now()
    for r in rows:
        r.status = "submitted"
        r.submitted_at = hozir

    ip, ua = get_client_info(request)
    log_audit(
        db,
        user_id=user.id,
        user_role=user.role,
        action_type="REPORT_SUBMITTED",
        table_name="report_submissions",
        record_id=rows[0].id,
        detail_message=f"{user.full_name}: {len(rows)} ta natija adminga yuborildi",
        ip_address=ip,
        device_info=ua,
    )
    db.commit()
    return {"message": f"{len(rows)} ta natija adminga yuborildi", "count": len(rows)}


@router.delete("/{report_id}")
def delete_draft(
    report_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    """Yuborilmagan qoralamani o'chiradi. Yuborilgani o'chirilmaydi."""
    r = db.query(ReportSubmission).filter(ReportSubmission.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Topilmadi")
    if r.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Bu natija allaqachon adminga yuborilgan — o'chirib bo'lmaydi.",
        )
    if r.doctor_id != user.id and user.role not in ("ceo", "admin"):
        raise HTTPException(status_code=403, detail="Bu sizning natijangiz emas")
    db.delete(r)
    db.commit()
    return {"message": "O'chirildi"}


@router.get("/pending")
def list_pending_reports(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    rows = (
        db.query(ReportSubmission)
        .options(joinedload(ReportSubmission.patient))
        .filter(ReportSubmission.status == "submitted")
        .order_by(ReportSubmission.created_at.desc())
        .all()
    )
    return [_row(r) for r in rows]


@router.get("/patient/{patient_id}")
def list_patient_reports(
    patient_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_doctor_or_admin_or_ceo),
):
    rows = (
        db.query(ReportSubmission)
        .options(joinedload(ReportSubmission.patient))
        .filter(ReportSubmission.patient_id == patient_id)
        .order_by(ReportSubmission.created_at.desc())
        .all()
    )
    return [_row(r) for r in rows]


@router.get("/{report_id}/pdf")
def get_report_pdf(
    report_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    from services.report_pdf import generate_report_pdf

    r = db.query(ReportSubmission).options(joinedload(ReportSubmission.patient)).filter(
        ReportSubmission.id == report_id
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Topilmadi")

    patient_name = f"{r.patient.first_name} {r.patient.last_name}" if r.patient else ""
    pdf_bytes = generate_report_pdf(
        template_label=r.template_label,
        content_html=r.filled_data or "",
        patient_name=patient_name,
        doctor_name=r.doctor_name,
        created_at_str=r.created_at.strftime("%d.%m.%Y %H:%M") if r.created_at else "",
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{r.template_label}_{r.id}.pdf"'},
    )


@router.patch("/{report_id}/mark-printed")
def mark_report_printed(
    report_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    r = db.query(ReportSubmission).filter(ReportSubmission.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Topilmadi")
    r.status = "printed"
    r.printed_by = user.id
    r.printed_at = datetime.now()
    db.commit()
    return {"message": "Chop etildi deb belgilandi"}
