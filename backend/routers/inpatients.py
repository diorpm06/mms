from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from auth_utils import require_admin_or_ceo, require_ceo
from database import get_db
from models.inpatient import Inpatient, InpatientPayment
from models.patient import Patient
from models.user import User
from services.audit import get_client_info, log_audit
from services.finance import cancel_patient_payment, process_inpatient_payment
from services.telegram_notify import send_telegram_message

router = APIRouter(prefix="/api/inpatients", tags=["inpatients"])


class InpatientCreate(BaseModel):
    patient_id: int
    room_number: str
    bed_number: str
    doctor_id: int | None = None
    referrer_id: int | None = None
    diagnosis: str | None = None
    daily_rate: int = Field(gt=0)
    planned_days: int | None = Field(default=None, ge=1, le=180)


class DischargeBody(BaseModel):
    discharged_at: date
    payment_type: str
    days_count: int | None = None
    amount: int | None = Field(default=None, gt=0)


class DailyPaymentBody(BaseModel):
    payment_date: date | None = None
    payment_type: str
    days_count: int = Field(default=1, ge=1, le=60)
    amount: int | None = Field(default=None, gt=0)


class CancelBody(BaseModel):
    reason: str = Field(min_length=3)


def _serialize_inp(i: Inpatient, days: int | None = None) -> dict:
    days = days or _calc_days(i)
    planned_days = _extract_planned_days(i.diagnosis)
    diagnosis = _clean_diagnosis(i.diagnosis)
    return {
        "id": i.id,
        "first_name": i.first_name,
        "last_name": i.last_name,
        "phone": i.phone,
        "room_number": i.room_number,
        "bed_number": i.bed_number,
        "doctor_id": i.doctor_id,
        "doctor_name": i.doctor.full_name if i.doctor else None,
        "referrer_id": i.referrer_id,
        "diagnosis": diagnosis,
        "planned_days": planned_days,
        "admitted_at": i.admitted_at.isoformat(),
        "discharged_at": i.discharged_at.isoformat() if i.discharged_at else None,
        "daily_rate": i.daily_rate,
        "status": i.status,
        "days": days,
        "total_amount": days * i.daily_rate,
        "is_cancelled": i.is_cancelled,
    }


def _calc_days(i: Inpatient) -> int:
    end = i.discharged_at or datetime.now()
    return max(1, (end.date() - i.admitted_at.date()).days + 1)


def _paid_totals(db: Session, inpatient_id: int) -> tuple[int, int]:
    payments = (
        db.query(InpatientPayment)
        .filter(
            InpatientPayment.inpatient_id == inpatient_id,
            InpatientPayment.is_cancelled == False,
        )
        .all()
    )
    paid_amount = sum(p.amount for p in payments)
    paid_days = sum(p.days_count for p in payments)
    return int(paid_amount), int(paid_days)


def _extract_planned_days(diagnosis: str | None) -> int | None:
    if not diagnosis:
        return None
    marker = "#plan_days="
    if marker not in diagnosis:
        return None
    try:
        part = diagnosis.split(marker, 1)[1].split()[0].strip()
        n = int(part)
        return n if n > 0 else None
    except Exception:
        return None


def _clean_diagnosis(diagnosis: str | None) -> str | None:
    if not diagnosis:
        return diagnosis
    marker = "#plan_days="
    if marker not in diagnosis:
        return diagnosis
    left = diagnosis.split(marker, 1)[0].strip()
    return left or None


@router.get("")
def list_inpatients(
    status: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    q = db.query(Inpatient).options(joinedload(Inpatient.doctor), joinedload(Inpatient.referrer))
    if status:
        q = q.filter(Inpatient.status == status, Inpatient.is_cancelled == False)
    else:
        q = q.filter(Inpatient.is_cancelled == False)
    items = q.order_by(Inpatient.admitted_at.desc()).all()
    return [_serialize_inp(i) for i in items]


@router.get("/history")
def inpatient_history(db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    items = (
        db.query(Inpatient)
        .options(joinedload(Inpatient.doctor))
        .filter(Inpatient.status == "chiqdi", Inpatient.is_cancelled == False)
        .order_by(Inpatient.discharged_at.desc())
        .limit(100)
        .all()
    )
    return [_serialize_inp(i) for i in items]


@router.post("")
def admit(
    data: InpatientCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_ceo),
):
    p = db.query(Patient).filter(Patient.id == data.patient_id, Patient.is_cancelled == False).first()
    if not p:
        raise HTTPException(status_code=404, detail="Bazada bemor topilmadi")
    diagnosis = (data.diagnosis or "").strip()
    if data.planned_days:
        diagnosis = f"{diagnosis} #plan_days={data.planned_days}".strip()
    inp = Inpatient(
        first_name=p.first_name,
        last_name=p.last_name,
        phone=p.phone,
        room_number=data.room_number,
        bed_number=data.bed_number,
        doctor_id=data.doctor_id or p.provider_id,
        referrer_id=data.referrer_id if data.referrer_id is not None else p.referrer_id,
        diagnosis=diagnosis or None,
        daily_rate=data.daily_rate,
        created_by=user.id,
        status="yotmoqda",
    )
    db.add(inp)
    db.flush()
    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="CREATE",
        table_name="inpatients", record_id=inp.id,
        new_data={"name": f"{inp.first_name} {inp.last_name}", "room": inp.room_number, "patient_id": p.id},
        ip_address=ip, device_info=device,
    )
    db.commit()
    return {"id": inp.id}


@router.post("/{inpatient_id}/discharge")
def discharge(
    inpatient_id: int,
    body: DischargeBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    inp = db.query(Inpatient).filter(Inpatient.id == inpatient_id, Inpatient.is_cancelled == False).first()
    if not inp or inp.status != "yotmoqda":
        raise HTTPException(status_code=400, detail="Bemor topilmadi yoki allaqachon chiqgan")
    inp.discharged_at = datetime.combine(body.discharged_at, datetime.min.time())
    planned_days = _extract_planned_days(inp.diagnosis)
    total_days = body.days_count or planned_days or _calc_days(inp)
    total_due = total_days * inp.daily_rate
    paid_amount, paid_days = _paid_totals(db, inp.id)
    remaining_amount = max(0, total_due - paid_amount)
    remaining_days = max(0, total_days - paid_days)
    amount = body.amount if body.amount is not None else remaining_amount
    pay_days = max(1, remaining_days) if amount > 0 else 0

    # Oldindan kunlik to'lov olingan bo'lsa, faqat qolganini olish kerak.
    if amount > 0:
        process_inpatient_payment(db, inp, amount, body.payment_type, pay_days)
        pay = InpatientPayment(
            inpatient_id=inp.id,
            amount=amount,
            payment_type=body.payment_type,
            days_count=pay_days,
            period_start=inp.admitted_at.date(),
            period_end=body.discharged_at,
            created_by=user.id,
        )
        db.add(pay)
    inp.status = "chiqdi"
    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="PAYMENT",
        table_name="inpatients", record_id=inp.id,
        new_data={"amount": amount, "days": pay_days, "paid_before": paid_amount},
        ip_address=ip, device_info=device,
    )
    db.commit()
    total_days = _calc_days(inp)
    msg = (
        f"🛏 Bemor chiqarildi\n"
        f"👤 {inp.first_name} {inp.last_name}\n"
        f"📅 Kun: {total_days}\n"
        f"💰 To'lov: {amount:,} so'm"
    ).replace(",", " ")
    import asyncio
    import threading
    threading.Thread(
        target=lambda: asyncio.run(send_telegram_message(msg, section="inpatients")),
        daemon=True,
    ).start()
    return {
        "amount": amount,
        "days": pay_days,
        "total_due": total_due,
        "paid_before": paid_amount,
        "remaining_before_discharge": remaining_amount,
    }


@router.post("/{inpatient_id}/daily-payment")
def daily_payment(
    inpatient_id: int,
    body: DailyPaymentBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    inp = db.query(Inpatient).filter(Inpatient.id == inpatient_id, Inpatient.is_cancelled == False).first()
    if not inp or inp.status != "yotmoqda":
        raise HTTPException(status_code=400, detail="Bemor topilmadi yoki aktiv emas")
    amount = body.amount or (inp.daily_rate * body.days_count)
    period_day = body.payment_date or date.today()
    process_inpatient_payment(db, inp, amount, body.payment_type, body.days_count)
    pay = InpatientPayment(
        inpatient_id=inp.id,
        amount=amount,
        payment_type=body.payment_type,
        days_count=body.days_count,
        period_start=period_day,
        period_end=period_day,
        created_by=user.id,
    )
    db.add(pay)
    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="PAYMENT",
        table_name="inpatients", record_id=inp.id,
        new_data={"amount": amount, "days": body.days_count, "type": "daily"},
        ip_address=ip, device_info=device,
    )
    db.commit()
    msg = (
        f"🛏 Yotgan bemor kunlik to'lovi\n"
        f"👤 {inp.first_name} {inp.last_name}\n"
        f"📅 {period_day.strftime('%d.%m.%Y')} ({body.days_count} kun)\n"
        f"💰 {amount:,} so'm"
    ).replace(",", " ")
    import asyncio
    import threading
    threading.Thread(
        target=lambda: asyncio.run(send_telegram_message(msg, section="inpatients")),
        daemon=True,
    ).start()
    return {"amount": amount, "days": body.days_count}


@router.post("/{inpatient_id}/cancel")
def cancel_inpatient(
    inpatient_id: int,
    body: CancelBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_ceo),
):
    inp = db.query(Inpatient).filter(Inpatient.id == inpatient_id).first()
    if not inp or inp.is_cancelled:
        raise HTTPException(status_code=400, detail="Topilmadi")
    inp.is_cancelled = True
    inp.cancelled_at = datetime.now()
    inp.cancelled_by = user.id
    inp.cancel_reason = body.reason
    ip, device = get_client_info(request)
    log_audit(db, user_id=user.id, user_role=user.role, action_type="CANCEL",
              table_name="inpatients", record_id=inp.id, reason=body.reason,
              ip_address=ip, device_info=device)
    db.commit()
    import asyncio
    import threading
    threading.Thread(
        target=lambda: asyncio.run(
            send_telegram_message(
                f"❌ Yotgan bemor bekor qilindi\n👤 {inp.first_name} {inp.last_name}\n📝 Sabab: {body.reason}",
                section="cancellations",
            )
        ),
        daemon=True,
    ).start()
    return {"message": "Bekor qilindi"}
