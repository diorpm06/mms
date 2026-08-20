from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.appointment import Appointment
from models.patient import Patient
from models.provider import Provider
from models.service import Service
from models.user import User
from auth_utils import require_admin_or_ceo, get_current_user
from services.ism import ism_tuzat
from routers.patients import _next_ticket

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


class AppointmentCreate(BaseModel):
    first_name: str
    last_name: str
    phone: str
    appointment_date: date
    appointment_time: str
    provider_id: int
    service_id: int
    notes: Optional[str] = None


def _appointment_row(a: Appointment) -> dict:
    return {
        "id": a.id,
        "first_name": a.first_name,
        "last_name": a.last_name,
        "phone": a.phone,
        "appointment_date": a.appointment_date.isoformat(),
        "appointment_time": a.appointment_time,
        "provider_id": a.provider_id,
        "service_id": a.service_id,
        "provider_name": a.provider.full_name if a.provider else None,
        "service_name": a.service.name if a.service else None,
        "service_price": a.service.price if a.service else 0,
        "status": a.status,
        "notes": a.notes,
        "created_at": a.created_at.isoformat(),
        "creator_name": a.creator.full_name if a.creator else None,
    }


@router.get("")
def list_appointments(
    appointment_date: Optional[date] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Appointment)
    if appointment_date:
        q = q.filter(Appointment.appointment_date == appointment_date)
    items = q.order_by(Appointment.appointment_date.asc(), Appointment.appointment_time.asc()).all()
    return [_appointment_row(i) for i in items]


@router.post("")
def create_appointment(
    body: AppointmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    provider = db.query(Provider).filter(Provider.id == body.provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Xizmat ko'rsatuvchi topilmadi")

    service = db.query(Service).filter(Service.id == body.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Xizmat turi topilmadi")

    item = Appointment(
        # Qanday yozilganidan qat'i nazar bosh harf bilan saqlaymiz
        first_name=ism_tuzat(body.first_name),
        last_name=ism_tuzat(body.last_name),
        phone=body.phone,
        appointment_date=body.appointment_date,
        appointment_time=body.appointment_time,
        provider_id=body.provider_id,
        service_id=body.service_id,
        status="kutilmoqda",
        notes=body.notes,
        created_by=user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _appointment_row(item)


@router.post("/{appointment_id}/check-in")
def check_in_appointment(
    appointment_id: int,
    payment_type: str = "cash",
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    appnt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appnt:
        raise HTTPException(status_code=404, detail="Yozilish topilmadi")

    if appnt.status == "kelgan":
        raise HTTPException(status_code=400, detail="Bemor allaqachon navbatga kiritilgan")

    service = db.query(Service).filter(Service.id == appnt.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Xizmat turi topilmadi")

    # Generate ticket & create patient entry in active queue
    ticket = _next_ticket(db)
    provider = db.query(Provider).filter(Provider.id == appnt.provider_id).first()

    patient = Patient(
        first_name=appnt.first_name,
        last_name=appnt.last_name,
        birth_date=date(1990, 1, 1), # Default placeholder birth date
        phone=appnt.phone,
        address="Klinika mijozi",
        referrer_id=None,
        provider_id=appnt.provider_id,
        service_id=appnt.service_id,
        payment_amount=service.price,
        payment_type=payment_type,
        ticket_number=ticket,
        queue_status="kutmoqda",
        cabinet=provider.cabinet if provider else None,
        created_by=user.id,
    )
    db.add(patient)

    appnt.status = "kelgan"
    db.commit()
    db.refresh(patient)
    return {
        "appointment_id": appnt.id,
        "patient_id": patient.id,
        "ticket_number": ticket,
        "message": "Bemor navbatga muvaffaqiyatli kiritildi",
    }


@router.post("/{appointment_id}/cancel")
def cancel_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    appnt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appnt:
        raise HTTPException(status_code=404, detail="Yozilish topilmadi")
    appnt.status = "bekor"
    db.commit()
    return {"message": "Yozilish bekor qilindi"}
