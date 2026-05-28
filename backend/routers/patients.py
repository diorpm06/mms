from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from auth_utils import require_admin_or_ceo, require_ceo
from database import get_db
from models.patient import Patient
from models.provider import Provider
from models.referrer import Referrer
from models.service import Service
from models.transaction import Transaction
from models.user import User
from schemas import PatientCreate
from services.audit import get_client_info, log_audit
from services.finance import cancel_patient_payment, process_payment
from services.reports_data import daily_report
from services.sheets import add_patient_to_sheets
from services.sheets_backup import push_row_to_backup_url
from services.telegram_notify import send_telegram_message

router = APIRouter(prefix="/api/patients", tags=["patients"])


class PatientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    birth_date: date | None = None
    phone: str | None = None
    address: str | None = None
    referrer_id: int | None = None
    provider_id: int | None = None
    service_id: int | None = None
    payment_amount: int | None = None
    payment_type: str | None = None
    reason: str = Field(min_length=3)


class CancelBody(BaseModel):
    reason: str = Field(min_length=3)


def _patient_row(p: Patient) -> dict:
    return {
        "id": p.id,
        "first_name": p.first_name,
        "last_name": p.last_name,
        "birth_date": p.birth_date.isoformat(),
        "phone": p.phone,
        "address": p.address,
        "referrer_id": p.referrer_id,
        "provider_id": p.provider_id,
        "service_id": p.service_id,
        "payment_amount": p.payment_amount,
        "payment_type": p.payment_type,
        "created_at": p.created_at.isoformat(),
        "created_by": p.created_by,
        "is_cancelled": p.is_cancelled,
        "cancel_reason": p.cancel_reason,
        "referrer_name": p.referrer.full_name if p.referrer else None,
        "provider_name": p.provider.full_name if p.provider else None,
        "service_name": p.service.name if p.service else None,
        "creator_name": p.creator.full_name if p.creator else None,
    }


def _patient_to_dict(p: Patient, db: Session) -> dict:
    ref = db.query(Referrer).filter(Referrer.id == p.referrer_id).first() if p.referrer_id else None
    prov = db.query(Provider).filter(Provider.id == p.provider_id).first()
    svc = db.query(Service).filter(Service.id == p.service_id).first()
    return {
        "created_at": p.created_at,
        "first_name": p.first_name,
        "last_name": p.last_name,
        "birth_date": p.birth_date.strftime("%d.%m.%Y"),
        "phone": p.phone,
        "address": p.address,
        "referrer_name": ref.full_name if ref else "—",
        "provider_name": prov.full_name if prov else "",
        "service_name": svc.name if svc else "",
        "payment_amount": p.payment_amount,
        "payment_type": p.payment_type,
        "holat": "bekor" if p.is_cancelled else "aktiv",
    }


@router.get("/today")
def today_patients(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    today = date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())
    patients = (
        db.query(Patient)
        .options(
            joinedload(Patient.referrer),
            joinedload(Patient.provider),
            joinedload(Patient.service),
            joinedload(Patient.creator),
        )
        .filter(Patient.created_at >= start, Patient.created_at <= end)
        .order_by(Patient.created_at.desc())
        .all()
    )
    return [_patient_row(p) for p in patients]


@router.get("")
def search_patients(
    search: str = "",
    include_cancelled: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    q = db.query(Patient).options(
        joinedload(Patient.referrer),
        joinedload(Patient.provider),
        joinedload(Patient.service),
        joinedload(Patient.creator),
    )
    if not include_cancelled:
        q = q.filter(Patient.is_cancelled == False)
    if search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
                Patient.phone.ilike(term),
            )
        )
    patients = q.order_by(Patient.created_at.desc()).limit(100).all()
    return [_patient_row(p) for p in patients]


@router.post("")
async def create_patient(
    data: PatientCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    svc = db.query(Service).filter(Service.id == data.service_id, Service.is_active == True).first()
    if not svc:
        raise HTTPException(status_code=400, detail="Xizmat topilmadi")
    if data.payment_amount != svc.price:
        raise HTTPException(status_code=400, detail="Narx xizmat narxidan farq qiladi")

    patient = Patient(**data.model_dump(), created_by=user.id)
    db.add(patient)
    db.flush()
    process_payment(db, patient)
    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="CREATE",
        table_name="patients", record_id=patient.id,
        new_data={"name": f"{patient.first_name} {patient.last_name}"},
        ip_address=ip, device_info=device,
        detail_message=f"Yangi mijoz qo'shildi: {patient.last_name} {patient.first_name}",
    )
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="PAYMENT",
        table_name="patients", record_id=patient.id,
        new_data={"amount": patient.payment_amount, "type": patient.payment_type},
        ip_address=ip, device_info=device,
        detail_message=f"To'lov qabul qilindi: {patient.payment_amount:,} so'm".replace(",", " "),
    )
    db.commit()
    db.refresh(patient)
    row = _patient_to_dict(patient, db)
    add_patient_to_sheets(row)
    # SPREADSHEET_ID bo'lmasa ham backup URL ulangan bo'lsa webhook'ga push qilamiz.
    push_row_to_backup_url(row)
    report = daily_report(db, date.today())
    msg = (
        f"🆕 Yangi mijoz ({user.role})\n"
        f"👤 {patient.first_name} {patient.last_name}\n"
        f"💰 {patient.payment_amount:,} so'm\n"
        f"💼 Balans: {report['current_balance']:,} so'm"
    ).replace(",", " ")
    await send_telegram_message(msg, section="registration")
    return {"id": patient.id, "message": "Mijoz qo'shildi"}


@router.get("/{patient_id}")
def get_patient(patient_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    p = (
        db.query(Patient)
        .options(
            joinedload(Patient.referrer),
            joinedload(Patient.provider),
            joinedload(Patient.service),
            joinedload(Patient.creator),
        )
        .filter(Patient.id == patient_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")
    return _patient_row(p)


@router.put("/{patient_id}")
def update_patient(
    patient_id: int,
    data: PatientUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_ceo),
):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")
    if p.is_cancelled:
        raise HTTPException(status_code=400, detail="Bekor qilingan yozuvni tahrirlab bo'lmaydi")
    old = _patient_row(p)
    updates = data.model_dump(exclude_unset=True, exclude={"reason"})
    for k, v in updates.items():
        setattr(p, k, v)
    p.updated_at = datetime.utcnow()
    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="UPDATE",
        table_name="patients", record_id=p.id,
        old_data=old, new_data=_patient_row(p), reason=data.reason,
        ip_address=ip, device_info=device,
    )
    db.commit()
    return _patient_row(p)


@router.post("/{patient_id}/cancel")
def cancel_patient(
    patient_id: int,
    body: CancelBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p or p.is_cancelled:
        raise HTTPException(status_code=400, detail="Topilmadi yoki bekor qilingan")
    tx = db.query(Transaction).filter(Transaction.patient_id == p.id, Transaction.is_cancelled == False).first()
    if not tx:
        raise HTTPException(status_code=400, detail="Tranzaksiya topilmadi")
    p.is_cancelled = True
    p.cancelled_at = datetime.utcnow()
    p.cancelled_by = user.id
    p.cancel_reason = body.reason
    cancel_patient_payment(db, p, tx)
    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="CANCEL",
        table_name="patients", record_id=p.id, reason=body.reason,
        ip_address=ip, device_info=device,
        detail_message=f"To'lov bekor qilindi — sabab: {body.reason}, kim: {user.full_name}",
    )
    db.commit()
    return {"message": "Bekor qilindi"}


@router.get("/{patient_id}/visits")
def patient_visits(patient_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")
    visits = (
        db.query(Patient)
        .options(joinedload(Patient.service), joinedload(Patient.provider))
        .filter(
            or_(
                Patient.phone == p.phone,
                (Patient.first_name == p.first_name) & (Patient.last_name == p.last_name),
            )
        )
        .order_by(Patient.created_at.desc())
        .all()
    )
    return [
        {
            "id": v.id,
            "service_name": v.service.name if v.service else None,
            "provider_name": v.provider.full_name if v.provider else None,
            "payment_amount": v.payment_amount,
            "payment_type": v.payment_type,
            "created_at": v.created_at.isoformat(),
            "is_cancelled": v.is_cancelled,
        }
        for v in visits
    ]
