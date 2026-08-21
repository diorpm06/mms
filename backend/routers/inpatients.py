from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session, joinedload

from auth_utils import require_admin_or_ceo, require_ceo
from database import get_db
from models.inpatient import Inpatient, InpatientPayment
from models.provider import Provider
from models.inpatient_tariff import InpatientTariff, InpatientTariffService, InpatientMaterial, InpatientItem, InpatientRoom, InpatientBed
from models.patient import Patient
from models.service import Service
from models.user import User
from services.audit import get_client_info, log_audit
from services.finance import (
    cancel_inpatient_payments,
    cancel_patient_payment,
    process_inpatient_payment,
)
from services.ism import ism_tuzat
from services.inpatient_accrual import (
    provider_accrual_detail,
    provider_inpatient_summary,
    reverse_inpatient_accruals,
    sync_inpatient_accruals,
)
from services.telegram_notify import send_telegram_background, send_telegram_message

router = APIRouter(prefix="/api/inpatients", tags=["inpatients"])


# -------------------------------------------------------------------------
# SCHEMAS
# -------------------------------------------------------------------------
class TariffCreate(BaseModel):
    name: str = Field(min_length=2)
    daily_rate: int = Field(gt=0)
    description: str | None = None
    included_service_ids: list[int] = []


class RoomCreate(BaseModel):
    room_number: str = Field(min_length=1)
    description: str | None = None
    bed_count: int = Field(default=2, ge=1, le=20)
    bed_numbers: list[str] | None = None


class BedCreate(BaseModel):
    bed_number: str = Field(min_length=1)


class MaterialCreate(BaseModel):
    name: str = Field(min_length=2)
    unit_name: str = "dona"
    unit_price: int = Field(ge=0)


class InpatientCreate(BaseModel):
    patient_id: int | None = None
    full_name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    birth_date: str | None = None
    address: str | None = None
    room_number: str = Field(min_length=1, max_length=50)
    bed_number: str = Field(min_length=1, max_length=50)
    tariff_id: int | None = None
    doctor_id: int | None = None
    referrer_id: int | None = None
    diagnosis: str | None = Field(default=None, max_length=2000)
    daily_rate: int = Field(gt=0, le=50_000_000)
    planned_days: int | None = Field(default=None, ge=1, le=180)
    initial_payment_amount: int | None = Field(default=None, ge=0, le=500_000_000)
    initial_payment_type: str | None = "cash"
    cash_amount: int | None = Field(default=None, ge=0)
    card_amount: int | None = Field(default=None, ge=0)
    click_amount: int | None = Field(default=None, ge=0)
    qr_amount: int | None = Field(default=None, ge=0)

    @field_validator("patient_id", "tariff_id", "doctor_id", "referrer_id", mode="before")
    @classmethod
    def sanitize_id_zero(cls, v):
        if v == 0 or v == "0" or v == "" or v is None:
            return None
        try:
            val = int(v)
            return val if val > 0 else None
        except Exception:
            return None


class InpatientItemCreate(BaseModel):
    item_type: str = Field(pattern="^(service|material)$")
    service_id: int | None = None
    material_id: int | None = None
    name: str | None = None
    quantity: int = Field(default=1, ge=1, le=1000)
    unit_price: int | None = Field(default=None, ge=0, le=50_000_000)
    is_included_in_tariff: bool = False

    @field_validator("service_id", "material_id", mode="before")
    @classmethod
    def sanitize_item_id_zero(cls, v):
        if v == 0 or v == "0" or v == "" or v is None:
            return None
        try:
            val = int(v)
            return val if val > 0 else None
        except Exception:
            return None


class PaymentCreate(BaseModel):
    amount: int = Field(gt=0, le=500_000_000)
    payment_type: str = "cash"
    payment_stage: str = Field(default="interim", pattern="^(advance|interim|discharge)$")
    days_count: int = Field(default=1, ge=0, le=365)
    period_start: date | None = None
    period_end: date | None = None
    cash_amount: int | None = Field(default=None, ge=0)
    card_amount: int | None = Field(default=None, ge=0)
    click_amount: int | None = Field(default=None, ge=0)
    qr_amount: int | None = Field(default=None, ge=0)
    # Hisobdan ortiq to'lov qabul qilinishi uchun ataylab tasdiqlanadi
    allow_overpay: bool = False


class DischargeBody(BaseModel):
    discharged_at: date
    payment_type: str = "cash"
    days_count: int | None = None
    amount: int | None = Field(default=None, ge=0)
    cash_amount: int | None = Field(default=None, ge=0)
    card_amount: int | None = Field(default=None, ge=0)
    click_amount: int | None = Field(default=None, ge=0)
    qr_amount: int | None = Field(default=None, ge=0)


class DailyPaymentBody(BaseModel):
    payment_date: date | None = None
    payment_type: str = "cash"
    days_count: int = Field(default=1, ge=1, le=60)
    amount: int | None = Field(default=None, gt=0, le=500_000_000)
    allow_overpay: bool = False
    cash_amount: int | None = Field(default=None, ge=0)
    card_amount: int | None = Field(default=None, ge=0)
    click_amount: int | None = Field(default=None, ge=0)
    qr_amount: int | None = Field(default=None, ge=0)


class CancelBody(BaseModel):
    reason: str = Field(min_length=3)


class InpatientExtendBody(BaseModel):
    additional_days: int | None = Field(default=None, ge=1, le=180)
    new_planned_days: int | None = Field(default=None, ge=1, le=180)


# -------------------------------------------------------------------------
# SERIALIZATION & HELPERS
# -------------------------------------------------------------------------
def _telegram_yubor(matn: str) -> None:
    """Telegram xabarini alohida fon oqimida (non-blocking thread) yuboradi.
    API javobi 0.1 millisekundda qaytadi va telegram sababli aylanib (hang) qolmaydi.
    """
    try:
        send_telegram_background(matn, section="inpatients")
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Statsionar telegram xabari yuborilmadi: %s", e)


def _qulflab_ol(db: Session, inpatient_id: int) -> Inpatient | None:
    """Yotgan bemor yozuvini qulflab o'qiydi.

    Ikki qurilmadan bir vaqtda to'lov kiritilsa ikkalasi ham eski qoldiqni
    ko'rib, hisobni buzardi. PostgreSQL'da qator qulflanadi; SQLite qulflashni
    qo'llab-quvvatlamaydi, u yerda oddiy o'qish bo'ladi.
    """
    q = db.query(Inpatient).filter(Inpatient.id == inpatient_id, Inpatient.is_cancelled == False)  # noqa: E712
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        q = q.with_for_update()
    return q.first()


def _koyka_bandmi(db: Session, xona: str, koyka: str, bundan_tashqari: int | None = None) -> Inpatient | None:
    """Shu koykada hozir yotgan bemorni qaytaradi (bo'sh bo'lsa None)."""
    q = db.query(Inpatient).filter(
        Inpatient.room_number == (xona or "").strip(),
        Inpatient.bed_number == (koyka or "").strip(),
        Inpatient.status == "yotmoqda",
        Inpatient.is_cancelled == False,  # noqa: E712
    )
    if bundan_tashqari:
        q = q.filter(Inpatient.id != bundan_tashqari)
    return q.first()


def _tolov_holatini_tekshir(inp: Inpatient, qoshiladigan: int, ruxsat: bool) -> None:
    """Hisobdan ortiq to'lov kiritilayotgan bo'lsa to'xtatadi."""
    if ruxsat:
        return
    hisob = _serialize_inp(inp)
    qoldiq = int(hisob["balance_due"])
    if qoshiladigan > qoldiq:
        ortiqcha = qoshiladigan - qoldiq
        raise HTTPException(
            status_code=400,
            detail=(
                f"To'lov hisobdan {ortiqcha:,} so'm ortiq. "
                f"Umumiy hisob {hisob['total_amount']:,}, to'langan {hisob['paid_total']:,}, "
                f"qolgan qarz {qoldiq:,} so'm. "
                "Oldindan ko'proq to'lanayotgan bo'lsa, tasdiqlang."
            ).replace(",", " "),
        )


def _serialize_inp(i: Inpatient, days: int | None = None) -> dict:
    elapsed_days = days or _calc_days(i)
    planned_days = _extract_planned_days(i.diagnosis)
    diagnosis = _clean_diagnosis(i.diagnosis)

    if i.status == "yotmoqda" and planned_days and planned_days > 0:
        bill_days = max(elapsed_days, planned_days)
    else:
        bill_days = elapsed_days

    room_total = bill_days * i.daily_rate

    # Items (extra services & materials)
    active_items = [it for it in (i.items or []) if not getattr(it, "is_cancelled", False)]
    extra_items_total = sum(it.total_price for it in active_items if not it.is_included_in_tariff)
    
    grand_total = room_total + extra_items_total

    # Payments
    active_payments = [p for p in (i.payments or []) if not getattr(p, "is_cancelled", False)]
    paid_total = sum(p.amount for p in active_payments)
    balance_due = grand_total - paid_total

    tariff_name = i.tariff.name if getattr(i, "tariff", None) else None

    return {
        "id": i.id,
        "first_name": i.first_name,
        "last_name": i.last_name,
        "phone": i.phone,
        "room_number": i.room_number,
        "bed_number": i.bed_number,
        "tariff_id": i.tariff_id,
        "tariff_name": tariff_name,
        "doctor_id": i.doctor_id,
        "doctor_name": i.doctor.full_name if getattr(i, "doctor", None) else None,
        # Shifokorga shu bemor uchun kuniga qancha yozilishi va shu paytgacha
        # jami qancha yozilgani — hisobda ko'rinib tursin
        "doctor_daily_rate": int(getattr(i.doctor, "inpatient_daily_rate", 0) or 0) if getattr(i, "doctor", None) else 0,
        # Reja emas, haqiqatda o'tgan kunlar bo'yicha — bemorning hisobi
        # oldindan to'liq ko'rsatilsa ham shifokorga faqat yotgan kun to'lanadi
        "doctor_accrued_total": elapsed_days * int(getattr(i.doctor, "inpatient_daily_rate", 0) or 0) if getattr(i, "doctor", None) else 0,
        "referrer_id": i.referrer_id,
        "diagnosis": diagnosis,
        "planned_days": planned_days,
        "admitted_at": i.admitted_at.isoformat(),
        "discharged_at": i.discharged_at.isoformat() if i.discharged_at else None,
        "daily_rate": i.daily_rate,
        "status": i.status,
        "days": days,
        "room_total": room_total,
        "extra_items_total": extra_items_total,
        "total_amount": grand_total,
        "paid_total": paid_total,
        "balance_due": balance_due,
        "is_cancelled": i.is_cancelled,
        "payments": [
            {
                "id": p.id,
                "amount": p.amount,
                "payment_type": p.payment_type,
                "payment_stage": p.payment_stage,
                "days_count": p.days_count,
                "created_at": p.created_at.isoformat(),
            }
            for p in active_payments
        ],
        "items": [
            {
                "id": it.id,
                "item_type": it.item_type,
                "name": it.name,
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "total_price": it.total_price,
                "is_included_in_tariff": it.is_included_in_tariff,
            }
            for it in active_items
        ],
    }


def _calc_days(i: Inpatient) -> int:
    end = i.discharged_at or datetime.now()
    return max(1, (end.date() - i.admitted_at.date()).days + 1)


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


def _update_planned_days(diagnosis: str | None, new_days: int) -> str:
    clean = _clean_diagnosis(diagnosis) or ""
    return f"{clean} #plan_days={new_days}".strip()


# -------------------------------------------------------------------------
# TARIFFS & MATERIALS MANAGEMENT (CEO ONLY)
# -------------------------------------------------------------------------
@router.get("/tariffs")
def list_tariffs(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    tariffs = (
        db.query(InpatientTariff)
        .options(joinedload(InpatientTariff.included_services).joinedload(InpatientTariffService.service))
        .filter(InpatientTariff.is_active == True)
        .all()
    )
    result = []
    for t in tariffs:
        inc_svcs = [
            {
                "id": ts.service.id,
                "name": ts.service.name,
                "price": ts.service.price,
                "category": ts.service.category,
            }
            for ts in t.included_services
            if ts.service
        ]
        result.append({
            "id": t.id,
            "name": t.name,
            "daily_rate": t.daily_rate,
            "description": t.description,
            "included_services": inc_svcs,
        })
    return result


@router.post("/tariffs")
def create_tariff(data: TariffCreate, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    t = InpatientTariff(
        name=data.name.strip(),
        daily_rate=data.daily_rate,
        description=data.description,
    )
    db.add(t)
    db.flush()

    if data.included_service_ids:
        for sid in set(data.included_service_ids):
            db.add(InpatientTariffService(tariff_id=t.id, service_id=sid))

    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.name}


@router.put("/tariffs/{tariff_id}")
def update_tariff(tariff_id: int, data: TariffCreate, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    t = db.query(InpatientTariff).filter(InpatientTariff.id == tariff_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tarif topilmadi")
    t.name = data.name.strip()
    t.daily_rate = data.daily_rate
    t.description = data.description

    db.query(InpatientTariffService).filter(InpatientTariffService.tariff_id == t.id).delete()
    if data.included_service_ids:
        for sid in set(data.included_service_ids):
            db.add(InpatientTariffService(tariff_id=t.id, service_id=sid))

    db.commit()
    return {"message": "Tarif yangilandi"}


@router.delete("/tariffs/{tariff_id}")
def delete_tariff(tariff_id: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    t = db.query(InpatientTariff).filter(InpatientTariff.id == tariff_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tarif topilmadi")
    t.is_active = False
    db.commit()
    return {"message": "O'chirildi"}


@router.get("/materials")
def list_materials(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    return db.query(InpatientMaterial).filter(InpatientMaterial.is_active == True).order_by(InpatientMaterial.name).all()


@router.post("/materials")
def create_material(data: MaterialCreate, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    m = InpatientMaterial(name=data.name.strip(), unit_name=data.unit_name.strip(), unit_price=data.unit_price)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.put("/materials/{material_id}")
def update_material(material_id: int, data: MaterialCreate, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    m = db.query(InpatientMaterial).filter(InpatientMaterial.id == material_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Material topilmadi")
    m.name = data.name.strip()
    m.unit_name = data.unit_name.strip()
    m.unit_price = data.unit_price
    db.commit()
    return m


@router.delete("/materials/{material_id}")
def delete_material(material_id: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    m = db.query(InpatientMaterial).filter(InpatientMaterial.id == material_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Material topilmadi")
    m.is_active = False
    db.commit()
    return {"message": "O'chirildi"}


# -------------------------------------------------------------------------
# ROOMS & BEDS MANAGEMENT (CEO ONLY)
# -------------------------------------------------------------------------
@router.get("/rooms")
def list_rooms(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    rooms = (
        db.query(InpatientRoom)
        .options(joinedload(InpatientRoom.beds))
        .filter(InpatientRoom.is_active == True)
        .order_by(InpatientRoom.id)
        .all()
    )
    if not rooms and db.query(InpatientRoom).count() == 0:
        # Seed default 8 rooms with 2 beds each into database ONLY when db has 0 rooms
        for i in range(1, 9):
            r = InpatientRoom(room_number=f"Palata №{i}")
            db.add(r)
            db.flush()
            db.add(InpatientBed(room_id=r.id, bed_number="1"))
            db.add(InpatientBed(room_id=r.id, bed_number="2"))
        db.commit()
        rooms = (
            db.query(InpatientRoom)
            .options(joinedload(InpatientRoom.beds))
            .filter(InpatientRoom.is_active == True)
            .order_by(InpatientRoom.id)
            .all()
        )

    res = []
    for r in rooms:
        active_beds = [b for b in r.beds if b.is_active]
        res.append({
            "id": r.id,
            "room_number": r.room_number,
            "description": r.description,
            "beds": [{"id": b.id, "bed_number": b.bed_number} for b in active_beds]
        })
    return res


@router.post("/rooms")
def create_room(data: RoomCreate, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    existing = db.query(InpatientRoom).filter(InpatientRoom.room_number == data.room_number.strip()).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            existing.description = data.description
            for b in (existing.beds or []):
                b.is_active = True
            db.commit()
            return {"id": existing.id, "room_number": existing.room_number}
        raise HTTPException(status_code=400, detail="Ushbu palata raqami allaqachon mavjud")

    r = InpatientRoom(room_number=data.room_number.strip(), description=data.description)
    db.add(r)
    db.flush()

    if data.bed_numbers and len(data.bed_numbers) > 0:
        for bn in data.bed_numbers:
            if bn.strip():
                db.add(InpatientBed(room_id=r.id, bed_number=bn.strip()))
    else:
        for i in range(1, data.bed_count + 1):
            db.add(InpatientBed(room_id=r.id, bed_number=f"{i}"))

    db.commit()
    db.refresh(r)
    return {"id": r.id, "room_number": r.room_number}


@router.put("/rooms/{room_id}")
def update_room(room_id: int, data: RoomCreate, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    r = db.query(InpatientRoom).filter(InpatientRoom.id == room_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Palata topilmadi")
    r.room_number = data.room_number.strip()
    r.description = data.description
    db.commit()
    return {"message": "Palata yangilandi"}


@router.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    r = db.query(InpatientRoom).filter(InpatientRoom.id == room_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Palata topilmadi")
    
    # Tekshirish: ushbu palatada hozir aktiv yotgan bemor bormi?
    active_pats = db.query(Inpatient).filter(
        Inpatient.room_number == r.room_number,
        Inpatient.status == "yotmoqda",
        Inpatient.is_cancelled == False
    ).all()
    if active_pats:
        names = ", ".join([f"{p.first_name} {p.last_name}" for p in active_pats])
        raise HTTPException(
            status_code=400,
            detail=f"Palatani o'chirib bo'lmaydi! Bu palatada bemor(lar) yotibdi ({names}). Avval ularni chiqaring yoki bekor qiling!"
        )

    r.is_active = False
    for b in (r.beds or []):
        b.is_active = False
    db.commit()
    return {"message": "Palata o'chirildi"}


@router.post("/rooms/{room_id}/beds")
def add_bed(room_id: int, data: BedCreate, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    r = db.query(InpatientRoom).filter(InpatientRoom.id == room_id, InpatientRoom.is_active == True).first()
    if not r:
        raise HTTPException(status_code=404, detail="Palata topilmadi")
    b = InpatientBed(room_id=r.id, bed_number=data.bed_number.strip())
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"id": b.id, "bed_number": b.bed_number}


@router.delete("/rooms/{room_id}/beds/{bed_id}")
def delete_bed(room_id: int, bed_id: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    b = db.query(InpatientBed).filter(InpatientBed.id == bed_id, InpatientBed.room_id == room_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Koyka topilmadi")

    r = db.query(InpatientRoom).filter(InpatientRoom.id == room_id).first()
    if r:
        active_pats = db.query(Inpatient).filter(
            Inpatient.room_number == r.room_number,
            Inpatient.bed_number == b.bed_number,
            Inpatient.status == "yotmoqda",
            Inpatient.is_cancelled == False
        ).all()
        if active_pats:
            names = ", ".join([f"{p.first_name} {p.last_name}" for p in active_pats])
            raise HTTPException(
                status_code=400,
                detail=f"Koykani o'chirib bo'lmaydi! Bu koykada bemor yotibdi ({names}). Avval bemorni chiqaring!"
            )

    b.is_active = False
    db.commit()
    return {"message": "Koyka o'chirildi"}


# -------------------------------------------------------------------------
# INPATIENTS API
# -------------------------------------------------------------------------
@router.get("/service-providers")
def list_inpatient_providers(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """Statsionarda tanlanishi mumkin bo'lgan xizmat ko'rsatuvchilar."""
    rows = (
        db.query(Provider)
        .filter(
            Provider.is_active == True,  # noqa: E712
            Provider.is_inpatient_provider == True,  # noqa: E712
        )
        .order_by(Provider.full_name)
        .all()
    )
    return [
        {
            "id": p.id,
            "full_name": p.full_name,
            "specialization": p.specialization,
            "daily_rate": int(p.inpatient_daily_rate or 0),
        }
        for p in rows
    ]


@router.get("/provider-earnings")
def inpatient_provider_earnings(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """Statsionar xizmat ko'rsatuvchilarning kunlik haqi bo'yicha yig'ma hisobot."""
    return provider_inpatient_summary(db)


@router.get("/provider-earnings/{provider_id}")
def inpatient_provider_detail(
    provider_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """Bitta xizmat ko'rsatuvchining kunma-kun haqlari."""
    return provider_accrual_detail(db, provider_id)


@router.get("")
def list_inpatients(
    status: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    # DIQQAT: bu yerda ilgari sync_inpatient_accruals(db) chaqirilardi va
    # ro'yxat har ochilganda yotgan bemorlarning kunlik haqi shifokor
    # balansiga qo'shilib borardi — bemor bir tiyin to'lamagan bo'lsa ham.
    # Endi haq faqat CHIQARISHDA, to'lov qilinganda yoziladi.
    q = db.query(Inpatient).options(
        joinedload(Inpatient.doctor),
        joinedload(Inpatient.referrer),
        joinedload(Inpatient.tariff),
        joinedload(Inpatient.items),
        joinedload(Inpatient.payments),
    )
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
        .options(
            joinedload(Inpatient.doctor),
            joinedload(Inpatient.tariff),
            joinedload(Inpatient.items),
            joinedload(Inpatient.payments),
        )
        .filter(Inpatient.status == "chiqdi", Inpatient.is_cancelled == False)
        .order_by(Inpatient.discharged_at.desc())
        .limit(100)
        .all()
    )
    return [_serialize_inp(i) for i in items]


@router.get("/{inpatient_id}")
def get_inpatient(inpatient_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    i = (
        db.query(Inpatient)
        .options(
            joinedload(Inpatient.doctor),
            joinedload(Inpatient.referrer),
            joinedload(Inpatient.tariff),
            joinedload(Inpatient.items),
            joinedload(Inpatient.payments),
        )
        .filter(Inpatient.id == inpatient_id, Inpatient.is_cancelled == False)
        .first()
    )
    if not i:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")
    return _serialize_inp(i)


@router.post("")
def admit(
    data: InpatientCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    # Bir koykaga ikki bemor yotqizilmasin — ilgari umuman tekshirilmasdi va
    # palata xaritasida ikki odam bitta koykada ko'rinardi.
    band = _koyka_bandmi(db, data.room_number, data.bed_number)
    if band:
        raise HTTPException(
            status_code=409,
            detail=f"{data.room_number}-palata {data.bed_number}-koykada "
                   f"{band.first_name} {band.last_name} yotibdi. Bo'sh koyka tanlang.",
        )

    # Statsionarda faqat "statsionar xizmat ko'rsatuvchi" deb belgilangan
    # shifokorlar tanlanadi — ular kunlik qat'iy haq oladi.
    if data.doctor_id:
        doc = db.query(Provider).filter(
            Provider.id == data.doctor_id,
            Provider.is_active == True,  # noqa: E712
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Shifokor topilmadi")
        if not getattr(doc, "is_inpatient_provider", False):
            raise HTTPException(
                status_code=400,
                detail=f"{doc.full_name} statsionar xizmat ko'rsatuvchi emas. "
                       "Shifokorlar bo'limidan uni statsionar uchun belgilang.",
            )

    # p — bazadagi mavjud bemor yozuvi. Yangi ism qo'lda kiritilsa, ambulator
    # "patients" jadvaliga yozuv OCHILMAYDI: u yerda xizmat, to'lov summasi va
    # to'lov turi majburiy, statsionarda esa bularning ma'nosi yo'q. Ilgari shu
    # sababli yangi bemor yotqizishda 500 xato chiqardi. Ism-familiya
    # to'g'ridan-to'g'ri statsionar yozuviga saqlanadi.
    p = None
    f_name = (data.first_name or "").strip()
    l_name = (data.last_name or "").strip()

    if data.patient_id:
        p = db.query(Patient).filter(Patient.id == data.patient_id, Patient.is_cancelled == False).first()
        if not p:
            raise HTTPException(status_code=404, detail="Bazada bemor topilmadi")
        f_name, l_name = p.first_name, p.last_name
    elif data.full_name and data.full_name.strip():
        parts = data.full_name.strip().split(maxsplit=1)
        f_name = parts[0]
        l_name = parts[1] if len(parts) > 1 else "."
    elif data.first_name and data.last_name:
        # Ilgari bu holat `elif` shartida bor edi, lekin ichkarida ishlov
        # berilmasdi — natijada f_name/l_name aniqlanmay NameError chiqardi.
        f_name = data.first_name.strip()
        l_name = data.last_name.strip()
    else:
        raise HTTPException(status_code=400, detail="Bazada bemor tanlanishi yoki yangi bemor ismi-familiyasi kiritilishi shart")

    # Qanday yozilganidan qat'i nazar bosh harf bilan saqlaymiz
    f_name = ism_tuzat(f_name) or f_name
    l_name = ism_tuzat(l_name) or l_name

    telefon = (p.phone if p else (data.phone or "").strip()) or "mavjud emas"

    diagnosis = (data.diagnosis or "").strip()
    if data.planned_days:
        diagnosis = f"{diagnosis} #plan_days={data.planned_days}".strip()

    inp = Inpatient(
        first_name=f_name,
        last_name=l_name,
        phone=telefon,
        room_number=data.room_number,
        bed_number=data.bed_number,
        tariff_id=data.tariff_id,
        # Ambulator shifokorga qaytmaydi: statsionar haqi faqat shu yerda
        # ataylab tanlangan xizmat ko'rsatuvchiga yoziladi.
        doctor_id=data.doctor_id,
        referrer_id=data.referrer_id if data.referrer_id is not None else (p.referrer_id if p else None),
        diagnosis=diagnosis or None,
        daily_rate=data.daily_rate,
        created_by=user.id,
        status="yotmoqda",
    )
    db.add(inp)
    db.flush()

    # Dastlabki bo'nak (advance payment) berilgan bo'lsa
    if data.initial_payment_amount and data.initial_payment_amount > 0:
        process_inpatient_payment(
            db, inp, data.initial_payment_amount, data.initial_payment_type or "cash", 1,
            data.cash_amount, data.card_amount, data.click_amount, data.qr_amount
        )
        pay = InpatientPayment(
            inpatient_id=inp.id,
            amount=data.initial_payment_amount,
            payment_type=data.initial_payment_type or "cash",
            payment_stage="advance",
            days_count=1,
            period_start=inp.admitted_at.date(),
            period_end=inp.admitted_at.date(),
            created_by=user.id,
        )
        db.add(pay)

    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="CREATE",
        table_name="inpatients", record_id=inp.id,
        new_data={"name": f"{inp.first_name} {inp.last_name}", "room": inp.room_number,
                  "patient_id": p.id if p else None},
        ip_address=ip, device_info=device,
    )
    db.commit()

    # Yotqizishda shifokorga haq YOZILMAYDI. Bemor hali to'lamagan —
    # ulush chiqarish kuni, to'lov qilinganda qo'shiladi.
    return {"id": inp.id}


# -------------------------------------------------------------------------
# INPATIENT ITEMS (ATTACH EXTRA SERVICE OR MATERIAL)
# -------------------------------------------------------------------------
@router.post("/{inpatient_id}/items")
def add_inpatient_item(
    inpatient_id: int,
    body: InpatientItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    inp = db.query(Inpatient).filter(Inpatient.id == inpatient_id, Inpatient.is_cancelled == False).first()
    if not inp or inp.status != "yotmoqda":
        raise HTTPException(status_code=400, detail="Bemor topilmadi yoki aktiv emas")

    item_name = body.name or ""
    unit_price = body.unit_price or 0

    if body.item_type == "service" and body.service_id:
        svc = db.query(Service).filter(Service.id == body.service_id).first()
        if not svc:
            raise HTTPException(status_code=404, detail="Xizmat topilmadi")
        item_name = svc.name
        unit_price = body.unit_price if body.unit_price is not None else svc.price
    elif body.item_type == "material" and body.material_id:
        mat = db.query(InpatientMaterial).filter(InpatientMaterial.id == body.material_id).first()
        if not mat:
            raise HTTPException(status_code=404, detail="Material topilmadi")
        item_name = mat.name
        unit_price = body.unit_price if body.unit_price is not None else mat.unit_price

    if body.is_included_in_tariff:
        unit_price = 0

    total_price = unit_price * body.quantity

    item = InpatientItem(
        inpatient_id=inp.id,
        item_type=body.item_type,
        service_id=body.service_id,
        material_id=body.material_id,
        name=item_name,
        quantity=body.quantity,
        unit_price=unit_price,
        total_price=total_price,
        is_included_in_tariff=body.is_included_in_tariff,
        created_by=user.id,
    )
    db.add(item)
    db.commit()
    return {"message": "Qo'shildi", "id": item.id, "total_price": total_price}


@router.delete("/{inpatient_id}/items/{item_id}")
def delete_inpatient_item(
    inpatient_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    item = db.query(InpatientItem).filter(InpatientItem.id == item_id, InpatientItem.inpatient_id == inpatient_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Element topilmadi")
    item.is_cancelled = True
    db.commit()
    return {"message": "O'chirildi"}


# -------------------------------------------------------------------------
# FLEXIBLE PAYMENTS & DISCHARGE
# -------------------------------------------------------------------------
@router.post("/{inpatient_id}/payment")
def record_payment(
    inpatient_id: int,
    body: PaymentCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    inp = _qulflab_ol(db, inpatient_id)
    if not inp:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")
    if inp.status != "yotmoqda":
        raise HTTPException(
            status_code=400,
            detail="Bu bemor allaqachon chiqarilgan — unga yangi to'lov yozib bo'lmaydi.",
        )
    _tolov_holatini_tekshir(inp, body.amount, body.allow_overpay)

    period_start = body.period_start or date.today()
    period_end = body.period_end or date.today()

    process_inpatient_payment(
        db, inp, body.amount, body.payment_type, body.days_count,
        body.cash_amount, body.card_amount, body.click_amount, body.qr_amount
    )
    pay = InpatientPayment(
        inpatient_id=inp.id,
        amount=body.amount,
        payment_type=body.payment_type,
        payment_stage=body.payment_stage,
        days_count=body.days_count,
        period_start=period_start,
        period_end=period_end,
        created_by=user.id,
    )
    db.add(pay)

    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="PAYMENT",
        table_name="inpatients", record_id=inp.id,
        new_data={"amount": body.amount, "stage": body.payment_stage, "type": body.payment_type},
        ip_address=ip, device_info=device,
    )
    db.commit()

    stage_txt = "Bo'nak (Avans)" if body.payment_stage == "advance" else ("Oraliq to'lov" if body.payment_stage == "interim" else "Chiqish to'lovi")
    msg = (
        f"🛏 Statsionar bemor to'lovi ({stage_txt})\n"
        f"👤 {inp.first_name} {inp.last_name}\n"
        f"💰 {body.amount:,} so'm ({body.payment_type})"
    ).replace(",", " ")
    _telegram_yubor(msg)

    return {"message": "To'lov saqlandi", "amount": body.amount}


@router.post("/{inpatient_id}/discharge")
def discharge(
    inpatient_id: int,
    body: DischargeBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    inp = _qulflab_ol(db, inpatient_id)
    if not inp or inp.status != "yotmoqda":
        raise HTTPException(status_code=400, detail="Bemor topilmadi yoki allaqachon chiqgan")

    # Chiqish sanasi tekshiruvi — ilgari umuman tekshirilmasdi va yotgan
    # sanadan oldingi sana kiritilsa kun soni manfiy chiqib hisob buzilardi.
    yotgan_kun = inp.admitted_at.date()
    if body.discharged_at < yotgan_kun:
        raise HTTPException(
            status_code=400,
            detail=f"Chiqish sanasi yotgan sanadan ({yotgan_kun.strftime('%d.%m.%Y')}) "
                   "oldin bo'lishi mumkin emas.",
        )
    if body.discharged_at > date.today():
        raise HTTPException(status_code=400, detail="Chiqish sanasi kelajakda bo'lishi mumkin emas.")

    inp.discharged_at = datetime.combine(body.discharged_at, datetime.min.time())
    days = body.days_count or _calc_days(inp)

    # Calculate grand total (room + extra items)
    room_total = days * inp.daily_rate
    active_items = [it for it in (inp.items or []) if not getattr(it, "is_cancelled", False)]
    extra_items_total = sum(it.total_price for it in active_items if not it.is_included_in_tariff)
    grand_total = room_total + extra_items_total

    active_payments = [p for p in (inp.payments or []) if not getattr(p, "is_cancelled", False)]
    paid_total = sum(p.amount for p in active_payments)

    remaining_due = max(0, grand_total - paid_total)
    amount = body.amount if body.amount is not None else remaining_due

    if amount > 0:
        process_inpatient_payment(
            db, inp, amount, body.payment_type, days,
            body.cash_amount, body.card_amount, body.click_amount, body.qr_amount
        )
        pay = InpatientPayment(
            inpatient_id=inp.id,
            amount=amount,
            payment_type=body.payment_type,
            payment_stage="discharge",
            days_count=days,
            period_start=inp.admitted_at.date(),
            period_end=body.discharged_at,
            created_by=user.id,
        )
        db.add(pay)

    inp.status = "chiqdi"
    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="DISCHARGE",
        table_name="inpatients", record_id=inp.id,
        new_data={"grand_total": grand_total, "paid_total": paid_total + amount},
        ip_address=ip, device_info=device,
    )
    db.commit()

    # Chiqarilgan sana saqlangach oxirgi kunlarning haqi yoziladi. Chiqish kuni
    # ham to'liq kun sifatida hisoblanadi.
    sync_inpatient_accruals(db, inp.id)

    msg = (
        f"🛏 Bemor chiqarildi (Выписка)\n"
        f"👤 {inp.first_name} {inp.last_name}\n"
        f"📅 Kun: {days}\n"
        f"💰 Yakuniy to'lov: {amount:,} so'm"
    ).replace(",", " ")
    _telegram_yubor(msg)

    return {
        "amount": amount,
        "days": days,
        "grand_total": grand_total,
        "paid_before": paid_total,
        "final_paid": paid_total + amount,
    }


@router.post("/{inpatient_id}/extend")
def extend_stay(
    inpatient_id: int,
    body: InpatientExtendBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    inp = _qulflab_ol(db, inpatient_id)
    if not inp or inp.status != "yotmoqda":
        raise HTTPException(status_code=400, detail="Bemor topilmadi yoki yotgan holatda emas")

    current_planned = _extract_planned_days(inp.diagnosis) or _calc_days(inp)

    if body.new_planned_days:
        target_days = body.new_planned_days
    elif body.additional_days:
        target_days = current_planned + body.additional_days
    else:
        raise HTTPException(status_code=400, detail="Qo'shimcha kunlar yoki yangi kunlar soni kiritilmadi")

    if target_days <= 0 or target_days > 365:
        raise HTTPException(status_code=400, detail="Yangi kunlar soni noto'g'ri (1 dan 365 gacha)")

    inp.diagnosis = _update_planned_days(inp.diagnosis, target_days)

    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="EXTEND_STAY",
        table_name="inpatients", record_id=inp.id,
        new_data={"old_planned_days": current_planned, "new_planned_days": target_days},
        ip_address=ip, device_info=device,
    )
    db.commit()

    added_count = target_days - current_planned
    msg = (
        f"🛏 Statsionar bemor kuni uzaytirildi (+{added_count} kun)\n"
        f"👤 {inp.first_name} {inp.last_name}\n"
        f"📅 Yangi muddat: {target_days} kun\n"
        f"💰 Kunlik narxi: {inp.daily_rate:,} so'm"
    ).replace(",", " ")
    _telegram_yubor(msg)

    return _serialize_inp(inp)


@router.post("/{inpatient_id}/daily-payment")
def daily_payment(
    inpatient_id: int,
    body: DailyPaymentBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    inp = _qulflab_ol(db, inpatient_id)
    if not inp or inp.status != "yotmoqda":
        raise HTTPException(status_code=400, detail="Bemor topilmadi yoki aktiv emas")

    amount = body.amount or (inp.daily_rate * body.days_count)
    _tolov_holatini_tekshir(inp, amount, body.allow_overpay)
    period_day = body.payment_date or date.today()
    process_inpatient_payment(db, inp, amount, body.payment_type, body.days_count)
    pay = InpatientPayment(
        inpatient_id=inp.id,
        amount=amount,
        payment_type=body.payment_type,
        payment_stage="interim",
        days_count=body.days_count,
        period_start=period_day,
        period_end=period_day,
        created_by=user.id,
    )
    db.add(pay)
    db.commit()
    return {"amount": amount, "days": body.days_count}


@router.post("/{inpatient_id}/cancel")
def cancel_inpatient(
    inpatient_id: int,
    body: CancelBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    inp = _qulflab_ol(db, inpatient_id)
    if not inp:
        raise HTTPException(status_code=400, detail="Topilmadi")

    # Olingan to'lovlar kassadan qaytariladi. Ilgari bu qilinmasdi: bemor bekor
    # qilinsa ham puli kassada va kunlik tushum hisobotida qolib ketardi.
    pul_qaytdi = cancel_inpatient_payments(db, inp, body.reason)

    # Shifokorga yozilgan kunlik haqlar ham qaytariladi
    haq_qaytdi = reverse_inpatient_accruals(db, inp.id)

    inp.is_cancelled = True
    inp.cancelled_at = datetime.now()
    inp.cancelled_by = user.id
    inp.cancel_reason = body.reason

    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="CANCEL",
        table_name="inpatients", record_id=inp.id,
        new_data={"reason": body.reason, "payments_reversed": pul_qaytdi,
                  "accruals_reversed": haq_qaytdi},
        ip_address=ip, device_info=device,
    )
    db.commit()
    return {
        "message": "Bekor qilindi",
        "payments_reversed": pul_qaytdi,
        "accruals_reversed": haq_qaytdi,
    }
