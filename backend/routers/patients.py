from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session, joinedload, selectinload

from auth_utils import require_admin_or_ceo, require_ceo, require_doctor_or_admin_or_ceo
from database import get_db
from models.patient import Patient
from models.patient_service import PatientService
from models.provider import Provider
from models.referrer import Referrer
from models.service import Service
from models.transaction import Transaction
from models.user import User
from schemas import PatientCreate
from services.audit import get_client_info, log_audit
from services.finance import cancel_patient_payment, process_payment, reprice_patient_payment
from services.ism import ism_tuzat
from services.reports_data import daily_report
from services.sheets import add_patient_to_sheets
from services.sheets_backup import push_row_to_backup_url
from services.telegram_notify import send_telegram_message

def get_queue_prefix_letter(svc_obj: Service | None) -> str:
    if not svc_obj:
        return "A"
    cat = (svc_obj.category or "").strip().upper()
    sname = (svc_obj.name or "").strip().upper()
    
    # 1. Laboratory tests -> ALWAYS prefix "L"
    lab_keywords = ["LAB", "ANALIZ", "QON", "TAHLIL", "GORMON", "EKSPRESS", "TORCH", "GEPATIT", "BIOKIMY", "KOAGUL", "SIYDIK", "AJRALMA", "ALLERG", "REVMAT", "PARAZIT", "ELEKTR", "TEST"]
    if any(k in cat for k in lab_keywords) or any(k in sname for k in ["TAHLIL", "ANALIZ", "IFA", "IGG", "IGM"]):
        return "L"

    # 2. UZI -> ALWAYS prefix "U"
    if "UZI" in cat or "ULTRATOVUSH" in cat or "UZI" in sname:
        return "U"
        
    # 3. Massaj -> ALWAYS prefix "M"
    if "MASSAJ" in cat or "MASSAJ" in sname:
        return "M"

    # 4. Ineksiya / Ukol -> ALWAYS prefix "I"
    if "INEKSIYA" in cat or "INJEKT" in cat or "UKOL" in cat or "UKOL" in sname:
        return "I"

    # 5. Konsultatsiya -> ALWAYS prefix "K"
    if "KONSULTAT" in cat or "SHIFOKOR" in cat:
        return "K"

    if svc_obj.queue_prefix and svc_obj.queue_prefix.strip():
        p = svc_obj.queue_prefix.strip().upper()
        if p != "A":
            return p

    if cat and cat[0].isalpha():
        return cat[0]
    return "A"


def _next_ticket(db: Session) -> str:
    today = date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())
    return _keyingi_raqam(db, "A", start, end)


def _bemorni_qulflab_ol(db: Session, patient_id: int):
    """
    Bemor qatorini QULFLAB o'qiydi (SELECT ... FOR UPDATE).

    Ikki qurilmadan bir vaqtda tahrirlash/bekor qilish sinovda ikkita xatoni
    ko'rsatdi:
      1) Ikkalasi ham xizmat ro'yxatini almashtirsa, o'chirish va qo'shish
         aralashib ketib, bemorda 2 barobar xizmat qatori qolardi
         (to'lov 100 000, xizmatlar jami 200 000).
      2) Ikkalasi ham bekor qilsa, ikkalasi ham muvaffaqiyatli tugardi —
         balanslar ikki marta orqaga qaytarilishi mumkin edi.

    Qulf tufayli ikkinchi so'rov birinchisi tugagunicha kutadi va yangilangan
    holatni ko'radi (masalan "allaqachon bekor qilingan" xatosini oladi).
    """
    q = db.query(Patient).filter(Patient.id == patient_id)
    # SQLite FOR UPDATE ni qo'llab-quvvatlamaydi — faqat PostgreSQL'da
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        q = q.with_for_update()
    return q.first()


def _keyingi_raqam(db: Session, prefiks: str, start, end) -> str:
    """
    Shu kun uchun `PREFIKS-NNN` ko'rinishidagi keyingi bo'sh raqam.

    Ilgari raqam COUNT(*) + 1 bilan olinardi. Bemor o'chirilsa sanoq kamayib,
    keyingi bemorga ALLAQACHON BERILGAN raqam qayta berilardi — TV taxtasida
    va chekda ikki bemorda bir xil navbat chiqardi.

    Endi mavjud raqamlarning eng kattasidan keyingisi olinadi, ya'ni o'chirish
    keyingi raqamlarga ta'sir qilmaydi.
    """
    qatorlar = (
        db.query(Patient.ticket_number)
        .filter(
            Patient.created_at >= start,
            Patient.created_at <= end,
            Patient.ticket_number.like(f"{prefiks}-%"),
        )
        .all()
    )
    eng_katta = 0
    for (raqam,) in qatorlar:
        try:
            n = int(str(raqam).rsplit("-", 1)[1])
        except (IndexError, ValueError):
            continue
        eng_katta = max(eng_katta, n)
    return f"{prefiks}-{eng_katta + 1:03d}"


router = APIRouter(prefix="/api/patients", tags=["patients"])


class EditServiceItem(BaseModel):
    service_id: int
    # Chegaralar ro'yxatga olishdagi bilan bir xil bo'lishi shart. Ilgari
    # tahrirlashda ular yo'q edi: manfiy narx, 0 yoki manfiy son qabul
    # qilinardi, 10^12 esa bazani "integer out of range" bilan yiqitardi.
    quantity: int = Field(default=1, ge=1, le=100)
    price: int | None = Field(default=None, ge=0, le=100_000_000)
    # Kurs belgisi va jadvali. None = "aytilmagan" degani — bunda mavjud
    # qiymat SAQLANADI.
    #
    # Ilgari bu maydonlar umuman yo'q edi va tahrirlashda is_course doim
    # False ga tushardi. Natijada oddiygina to'lov turini naqddan kartaga
    # o'zgartirish bemorni "Davolanishdagilar" ro'yxatidan butunlay
    # chiqarib yuborardi: kurs kunlari sanalmay qolardi, ertasiga bemor
    # kelganda tizim uni yangi bemor deb qayta to'lov so'rardi.
    is_course: bool | None = None
    course_days: str | None = Field(default=None, max_length=200)


class PatientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    birth_date: date | None = None
    phone: str | None = None
    address: str | None = None
    referrer_id: int | None = None
    provider_id: int | None = None
    service_id: int | None = None
    payment_amount: int | None = Field(default=None, ge=0, le=100_000_000)
    payment_type: str | None = None
    cash_amount: int | None = Field(default=None, ge=0)
    card_amount: int | None = Field(default=None, ge=0)
    click_amount: int | None = Field(default=None, ge=0)
    qr_amount: int | None = Field(default=None, ge=0)
    # Xizmatlar ro'yxati qayta yuborilsa — eskisi almashtiriladi va
    # to'lov summasi qaytadan hisoblanadi (chegirma saqlanib qoladi).
    services: list[EditServiceItem] | None = None
    # Chegirmani tahrirlab bo'lmasdi — noto'g'ri kiritilgan chegirmani
    # tuzatishning yagona yo'li bemorni o'chirib qayta yozish edi.
    discount_amount: int | None = Field(default=None, ge=0, le=100_000_000)
    discount_reason: str | None = None
    reason: str = Field(min_length=3)

    @field_validator("referrer_id", "provider_id", "service_id", mode="before")
    @classmethod
    def sanitize_id_zero(cls, v):
        if v == 0 or v == "0" or v == "" or v is None:
            return None
        try:
            val = int(v)
            return val if val > 0 else None
        except Exception:
            return None

    @field_validator("payment_type")
    @classmethod
    def validate_payment_type(cls, v):
        """
        Ro'yxatga olishda to'lov turi tekshirilardi, tahrirlashda esa yo'q —
        "bitcoin" kabi har qanday matn saqlanib, hisobotda tanilmay qolardi.
        """
        if v is None:
            return v
        ruxsat = ("cash", "card", "click", "qr", "naqd", "karta", "payme",
                  "split", "aralash", "later", "keyinroq", "nasiya", "qarz")
        if v not in ruxsat:
            raise ValueError("To'lov turi noto'g'ri (cash, card, click, qr, split, later)")
        return v


class CancelBody(BaseModel):
    reason: str = Field(min_length=3)


def _apply_payment_split(p: Patient, data: "PatientUpdate") -> None:
    """
    To'lov turiga qarab naqd/karta/click/qr taqsimotini qayta yozadi.

    Ilgari aralash to'lovda naqd bo'lmagan qismning HAMMASI card_amount ga
    tushardi — Click yoki QR tanlansa ham hisobotda "Karta" bo'lib chiqardi.
    """
    ptype = (p.payment_type or "").lower()
    jami = p.payment_amount or 0
    p.cash_amount = p.card_amount = p.click_amount = p.qr_amount = 0

    if ptype in ("cash", "naqd"):
        p.cash_amount = jami
    elif ptype in ("later", "keyinroq", "nasiya", "qarz"):
        pass
    elif ptype in ("click", "payme"):
        p.click_amount = jami
    elif ptype == "qr":
        p.qr_amount = jami
    elif ptype in ("split", "aralash"):
        naqd = data.cash_amount if data.cash_amount is not None else (p.cash_amount or 0)
        p.cash_amount = min(max(0, naqd), jami)
        qolgan = jami - p.cash_amount
        klik = max(0, data.click_amount or 0)
        qr = max(0, data.qr_amount or 0)
        karta = max(0, data.card_amount or 0)
        soralgan = karta + klik + qr
        if soralgan > 0 and (klik or qr):
            p.click_amount = int(qolgan * klik / soralgan)
            p.qr_amount = int(qolgan * qr / soralgan)
            p.card_amount = max(0, qolgan - p.click_amount - p.qr_amount)
        else:
            p.card_amount = qolgan
    else:
        p.card_amount = jami


def _patient_row(p: Patient) -> dict:
    return {
        "id": p.id,
        "first_name": p.first_name,
        "last_name": p.last_name,
        "full_name": f"{p.first_name or ''} {p.last_name or ''}".strip(),
        "birth_date": p.birth_date.isoformat(),
        "phone": p.phone,
        "address": p.address,
        "referrer_id": p.referrer_id,
        "provider_id": p.provider_id,
        "service_id": p.service_id,
        "payment_amount": p.payment_amount,
        "payment_type": p.payment_type,
        "cash_amount": p.cash_amount or 0,
        "click_amount": p.click_amount or 0,
        "qr_amount": p.qr_amount or 0,
        "card_amount": p.card_amount or 0,
        "discount_amount": p.discount_amount or 0,
        "discount_reason": p.discount_reason,
        "diagnosis": p.diagnosis,
        "complaints": p.complaints,
        "prescription": p.prescription,
        "created_at": p.created_at.isoformat(),
        "created_by": p.created_by,
        "is_cancelled": p.is_cancelled,
        "cancel_reason": p.cancel_reason,
        "is_paper_entry": bool(p.is_paper_entry),
        # Oldindan to'langan kursning navbatdagi tashrifi bo'lsa — to'lov 0
        "prepaid_from_id": p.prepaid_from_id,
        "is_prepaid_visit": p.prepaid_from_id is not None,
        "ticket_number": p.ticket_number or f"A-{p.id:03d}",
        "queue_status": p.queue_status or "kutmoqda",
        "cabinet": p.cabinet,
        "referrer_name": p.referrer.full_name if p.referrer else None,
        "provider_name": p.provider.full_name if p.provider else None,
        "service_name": p.service.name if p.service else None,
        "service_category": p.service.category if p.service else "Umumiy",
        "category": p.service.category if p.service else "Umumiy",
        "creator_name": p.creator.full_name if p.creator else None,
        # Bemor olgan BARCHA xizmatlar. service_name faqat asosiy (birinchi)
        # xizmatni ko'rsatadi — ro'yxatlarda hammasi ko'rinishi uchun shu kerak.
        "services": [
            {
                "patient_service_id": ps.id,
                "service_id": ps.service_id,
                "service_name": ps.service.name if ps.service else None,
                "category": ps.service.category if ps.service else "Umumiy",
                "quantity": ps.quantity,
                "unit_price": ps.unit_price,
                "total_price": ps.total_price,
                # Bir necha kunlik oldindan to'lov bo'lsa — chekda va
                # ro'yxatlarda qolgan kun ko'rsatiladi
                "used_count": int(ps.used_count or 0),
                "remaining": max(0, int(ps.quantity or 1) - int(ps.used_count or 0)),
                # Kurs holati. Tahrirlash oynasi buni o'qib, saqlashda
                # qaytarib yuboradi — aks holda oddiy tahrirlash kurs
                # belgisini o'chirib yuborardi.
                "is_course": bool(ps.is_course),
                "course_days": ps.course_days,
            }
            for ps in (p.services_detail or [])
        ],
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
def today_patients(db: Session = Depends(get_db), _: User = Depends(require_doctor_or_admin_or_ceo)):
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
            # _patient_row har bir xizmat qatorida ps.service.name ni o'qiydi.
            # services_detail o'zi "selectin" bilan bitta so'rovda kelardi,
            # lekin ichidagi service bog'lanishi kelmasdi — har bir YANGI
            # xizmat turi uchun alohida SELECT ketardi (takrorlanganini
            # SQLAlchemy o'z xotirasidan oladi). Katalogda xizmat turi
            # ko'p bo'lgani sari bu qimmatlashadi.
            selectinload(Patient.services_detail).joinedload(PatientService.service),
        )
        # Ilgari qog'oz yozuvlari kechadan buyon ko'rsatilardi: tungi smena
        # qog'ozga yozilib ertalab kiritilgani uchun. Endi custom_date sanani
        # o'z kuniga qo'yadi, shu sababli kechagi navbatchilik bugungi
        # ro'yxatda ham turib olar va ekrandagi son kunlik hisobotdan farq
        # qilardi. Har bir yozuv faqat o'z kunida ko'rinadi.
        .filter(Patient.created_at >= start, Patient.created_at <= end)
        .order_by(Patient.created_at.desc())
        .all()
    )
    return [_patient_row(p) for p in patients]


def _build_patient_search_query(q_builder, raw_search: str):
    search_str = raw_search.strip()
    if not search_str:
        return q_builder

    term = f"%{search_str}%"

    full_name_1 = func.concat(Patient.first_name, " ", Patient.last_name)
    full_name_2 = func.concat(Patient.last_name, " ", Patient.first_name)

    conditions = [
        Patient.first_name.ilike(term),
        Patient.last_name.ilike(term),
        Patient.phone.ilike(term),
        Patient.ticket_number.ilike(term),
        Patient.address.ilike(term),
        full_name_1.ilike(term),
        full_name_2.ilike(term),
    ]

    words = [w for w in search_str.split() if len(w) > 1]
    if len(words) > 1:
        word_conditions = []
        for w in words:
            wt = f"%{w}%"
            fn2 = func.concat(Patient.first_name, " ", Patient.last_name)
            word_conditions.append(
                or_(
                    Patient.first_name.ilike(wt),
                    Patient.last_name.ilike(wt),
                    Patient.phone.ilike(wt),
                    Patient.ticket_number.ilike(wt),
                    fn2.ilike(wt),
                )
            )
        conditions.append(and_(*word_conditions))

    return q_builder.filter(or_(*conditions))


@router.get("")
def search_patients(
    search: str = "",
    include_cancelled: bool = False,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_doctor_or_admin_or_ceo),
):
    q = db.query(Patient).options(
        joinedload(Patient.referrer),
        joinedload(Patient.provider),
        joinedload(Patient.service),
        joinedload(Patient.creator),
        # Xizmat qatorlaridagi service ham bitta so'rovda kelsin
        selectinload(Patient.services_detail).joinedload(PatientService.service),
    )
    if not include_cancelled:
        q = q.filter(Patient.is_cancelled == False)
    if search.strip():
        q = _build_patient_search_query(q, search)

    max_limit = limit if (limit and limit > 0) else 50000
    patients = q.order_by(Patient.created_at.desc()).limit(max_limit).all()
    return [_patient_row(p) for p in patients]


@router.get("/search")
def search_patients_alias(
    q: str = "",
    search: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_doctor_or_admin_or_ceo),
):
    term = (q or search).strip()
    return search_patients(search=term, include_cancelled=True, db=db, _=_)


@router.get("/autocomplete")
def autocomplete_patients(
    q: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_doctor_or_admin_or_ceo),
):
    query_str = q.strip()
    if not query_str or len(query_str) < 2:
        return []

    q_builder = db.query(Patient).filter(Patient.is_cancelled == False)
    q_builder = _build_patient_search_query(q_builder, query_str)

    if query_str.isdigit() and len(query_str) == 4:
        from sqlalchemy import extract
        q_builder = q_builder.filter(extract("year", Patient.birth_date) == int(query_str))

    patients = (
        q_builder
        .order_by(Patient.created_at.desc())
        .limit(60)
        .all()
    )

    # Group by unique patient identity (first_name, last_name, birth_date)
    unique_patients = {}
    for p in patients:
        fn = (p.first_name or "").strip().lower()
        ln = (p.last_name or "").strip().lower()
        bd = p.birth_date.isoformat() if p.birth_date else ""
        key = f"{fn}_{ln}_{bd}"

        if key not in unique_patients:
            full_name = f"{p.first_name} {p.last_name}".strip()
            birth_year = p.birth_date.year if p.birth_date else None
            birth_str = p.birth_date.strftime("%d.%m.%Y") if p.birth_date else ""

            unique_patients[key] = {
                "id": p.id,
                "first_name": p.first_name,
                "last_name": p.last_name,
                "full_name": full_name,
                "birth_date": birth_str,
                "birth_year": birth_year,
                "phone": p.phone or "",
                "address": p.address or "",
                "referrer_id": p.referrer_id,
                "last_visit": p.created_at.strftime("%d.%m.%Y"),
                "visit_count": 1,
            }
        else:
            unique_patients[key]["visit_count"] += 1

    return list(unique_patients.values())[:10]



def _sync_patient_background(patient_ids: list, user_role: str, first_name: str, last_name: str, payment_type: str, total_batch_paid: int):
    """Executes Google Sheets sync, backup webhook, and Telegram notification asynchronously."""
    from database import SessionLocal
    import asyncio

    db = SessionLocal()
    try:
        patients = db.query(Patient).filter(Patient.id.in_(patient_ids)).all()
        for p in patients:
            try:
                row = _patient_to_dict(p, db)
                add_patient_to_sheets(row)
                push_row_to_backup_url(row)
            except Exception as e:
                print(f"[BG Sync Sheets Warning]: {e}")

        report = daily_report(db, date.today())
        svc_names = ", ".join(p.service.name if (p.service and p.service.name) else "Xizmat" for p in patients)
        msg = (
            f"🆕 Yangi mijoz qabul qilindi ({user_role})\n"
            f"👤 {first_name} {last_name}\n"
            f"🩺 Xizmatlar: {svc_names}\n"
            f"💳 To'lov turi: {payment_type.upper()}\n"
            f"💰 Jami: {total_batch_paid:,} so'm\n"
            f"💼 Balans: {report['current_balance']:,} so'm"
        ).replace(",", " ")
        from services.telegram_notify import send_telegram_background
        send_telegram_background(msg, section="registration")
    except Exception as ex:
        print(f"[BG Task Error]: {ex}")
    finally:
        db.close()


@router.post("")
async def create_patient(
    data: PatientCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    # Construct list of services to create
    service_items = []
    if data.services and len(data.services) > 0:
        consolidated = {}
        for s in data.services:
            key = (s.service_id, s.provider_id, bool(getattr(s, "is_course", False)))
            if key not in consolidated:
                consolidated[key] = {
                    "service_id": s.service_id,
                    "provider_id": s.provider_id,
                    "price": s.price,
                    "quantity": s.quantity if (s.quantity and s.quantity > 0) else 1,
                    "is_course": bool(getattr(s, "is_course", False)),
                    "course_days": getattr(s, "course_days", None),
                }
            else:
                consolidated[key]["quantity"] += (s.quantity if (s.quantity and s.quantity > 0) else 1)

        for key, item in consolidated.items():
            svc = db.query(Service).filter(Service.id == item["service_id"], Service.is_active == True).first()
            if not svc:
                raise HTTPException(status_code=400, detail=f"Xizmat (ID: {item['service_id']}) topilmadi")
            qty = item["quantity"]
            unit_price = item["price"] if item["price"] is not None else svc.price
            price = unit_price * qty
            service_items.append({
                "service_id": item["service_id"],
                "provider_id": item["provider_id"],
                "price": price,
                "quantity": qty,
                "unit_price": unit_price,
                "is_course": item["is_course"],
                "course_days": item.get("course_days"),
            })
    elif data.service_id:
        svc = db.query(Service).filter(Service.id == data.service_id, Service.is_active == True).first()
        if not svc:
            raise HTTPException(status_code=400, detail="Xizmat topilmadi")
        price = data.payment_amount if data.payment_amount is not None else svc.price
        service_items.append({"service_id": data.service_id, "provider_id": data.provider_id, "price": price})
    else:
        raise HTTPException(status_code=400, detail="Kamida bitta xizmat tanlang")

    # ── Bog'liq yozuvlar haqiqatan mavjudmi ────────────────────────────────
    # Ilgari mavjud bo'lmagan yo'naltiruvchi/shifokor ID si bilan bemor
    # yozib yuborilardi: yo'naltiruvchida baza "foreign key" xatosi bilan
    # yiqilardi, shifokorda esa bemor mavjud bo'lmagan doktorga biriktirilib,
    # hisobotlarda ko'rinmay qolardi.
    if data.referrer_id:
        if not db.query(Referrer).filter(Referrer.id == data.referrer_id).first():
            raise HTTPException(status_code=400, detail="Yo'naltiruvchi topilmadi")
    if data.provider_id:
        if not db.query(Provider).filter(Provider.id == data.provider_id).first():
            raise HTTPException(status_code=400, detail="Shifokor topilmadi")

    # ── Chegirma umumiy narxdan oshmasin ───────────────────────────────────
    # Ilgari narxdan katta chegirma qabul qilinardi va to'lov 0 ga tushardi.
    _xizmat_jami = 0
    for _it in service_items:
        _sv = db.query(Service).filter(Service.id == _it["service_id"]).first()
        _narx = _it.get("price")
        if _narx is None:
            _narx = _sv.price if _sv else 0
        _xizmat_jami += int(_narx) * int(_it.get("quantity", 1) or 1)
    if (data.discount_amount or 0) > _xizmat_jami:
        raise HTTPException(
            status_code=400,
            detail=(f"Chegirma ({data.discount_amount:,} so'm) umumiy narxdan "
                    f"({_xizmat_jami:,} so'm) katta bo'lishi mumkin emas"),
        )

    # Split F.I.Sh into first_name and last_name if single string provided
    first_name_clean = data.first_name.strip()
    last_name_clean = (data.last_name or "").strip()
    if not last_name_clean and " " in first_name_clean:
        parts = first_name_clean.split(" ", 1)
        first_name_clean = parts[0]
        last_name_clean = parts[1]

    # Qanday yozilganidan qat'i nazar bosh harf bilan saqlaymiz:
    # "aBduLLayev" -> "Abdullayev",  "g'ANIJON" -> "G'anijon"
    first_name_clean = ism_tuzat(first_name_clean) or ""
    last_name_clean = ism_tuzat(last_name_clean) or ""

    # Bir xil F.I.Sh + tug'ilgan sana bilan bemor SHU KUNI allaqachon ro'yxatga
    # olingan bo'lsa — bu tasodifiy ikki marta kiritish ehtimoli juda yuqori
    # (ism-familiya boshqa odamda ham bo'lishi mumkin, lekin xuddi shu tug'ilgan
    # sana bilan ham mos kelishi ehtimoli juda kam). Qayta tashrif bo'lsa,
    # admin buni tasdiqlab (confirm_duplicate) davom ettirishi mumkin.
    if not data.confirm_duplicate:
        dup_day = data.custom_date or date.today()
        dup_start = datetime.combine(dup_day, datetime.min.time())
        dup_end = datetime.combine(dup_day, datetime.max.time())
        existing = (
            db.query(Patient)
            .filter(
                func.lower(Patient.first_name) == first_name_clean.lower(),
                func.lower(Patient.last_name) == last_name_clean.lower(),
                Patient.birth_date == data.birth_date,
                Patient.created_at >= dup_start,
                Patient.created_at <= dup_end,
                Patient.is_cancelled == False,
            )
            .order_by(Patient.created_at.desc())
            .first()
        )
        if existing:
            time_str = existing.created_at.strftime("%H:%M")
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Bu bemor ({first_name_clean} {last_name_clean}, {data.birth_date}) "
                    f"shu kuni soat {time_str} da allaqachon ro'yxatdan o'tkazilgan. "
                    f"Agar bu haqiqatan ham qayta/boshqa tashrif bo'lsa, tasdiqlab davom eting."
                ),
            )

    ip, device = get_client_info(request)
    created_patients = []
    total_batch_paid = 0
    total_raw_price = sum(item["price"] for item in service_items)
    discount_total = data.discount_amount or 0

    # Group service_items by department/category (or queue prefix letter)
    # So multiple services in UZI get 1 single UZI ticket (e.g. U-001)
    # Multiple services in Laboratoriya get 1 single Laboratoriya ticket (e.g. L-001)
    department_groups = {}
    for item in service_items:
        svc_obj = db.query(Service).filter(Service.id == item["service_id"]).first()
        svc_prefix = get_queue_prefix_letter(svc_obj)
        svc_cat = (svc_obj.category or "").strip() if svc_obj else "Umumiy"
        
        # Group strictly by queue prefix letter (e.g. "L" for all Laboratoriya tests, "U" for all UZI)
        dep_key = svc_prefix
        if dep_key not in department_groups:
            department_groups[dep_key] = {
                "prefix": svc_prefix,
                "category": svc_cat,
                "items": [],
            }
        department_groups[dep_key]["items"].append(item)

    # Chegirma va naqd/karta summasi bo'limlar orasida ulush bo'yicha
    # bo'linadi. int() har bir bo'lakni pastga yaxlitlagani uchun yig'indi
    # asl summadan 1-2 so'm kam chiqib, bemordan ekranda ko'rsatilgandan
    # ko'proq olinar edi. Qoldiqni oxirgi bo'limga qo'shib, yig'indi aniq
    # to'g'ri chiqishini ta'minlaymiz.
    _groups = list(department_groups.items())
    _allocated_discount = 0
    _allocated_cash = 0

    # ── Chegirma qaysi xizmatlardan ayirilishi ─────────────────────────
    # Ilgari faqat BITTA xizmat tanlanardi. Chegirma o'sha xizmat narxidan
    # katta bo'lsa (masalan 20,000 lik xizmatga 100,000 chegirma), ortiqcha
    # qismi hech qayerga tushmasdan yo'qolardi — natijada bemordan ekranda
    # ko'rsatilgandan ko'proq pul olinardi. Endi bir nechta xizmat
    # belgilanadi va chegirma ular orasida narx ulushiga qarab bo'linadi.
    nishon_idlar = set(data.discount_target_service_ids or [])
    if not nishon_idlar and data.discount_target_service_id:
        nishon_idlar = {data.discount_target_service_id}

    # Xizmat belgilanmagan bo'lsa yoki chegirma butun summani qoplasa —
    # hamma xizmatga taqsimlanadi (bunda tanlashning ma'nosi qolmaydi).
    if not nishon_idlar or (total_raw_price > 0 and discount_total >= total_raw_price):
        nishon_idlar = {it["service_id"] for it in service_items}

    # Belgilangan xizmatlarning guruh bo'yicha summasi
    _nishon_summa: dict[int, int] = {}
    for _gi, (_k, _d) in enumerate(_groups):
        s = sum(it["price"] for it in _d["items"]
                if it["service_id"] in nishon_idlar)
        if s > 0:
            _nishon_summa[_gi] = s
    _jami_nishon = sum(_nishon_summa.values())
    _oxirgi_nishon = max(_nishon_summa) if _nishon_summa else None

    # Belgilangan xizmatlar narxidan ortiq chegirma berib bo'lmaydi —
    # aks holda ortiqcha qism jimgina yo'qolardi.
    if discount_total > 0 and _jami_nishon > 0 and discount_total > _jami_nishon:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Chegirma ({discount_total:,} so'm) belgilangan xizmatlar "
                f"summasidan ({_jami_nishon:,} so'm) katta. Yana xizmat "
                f"belgilang yoki chegirmani kamaytiring."
            ),
        )

    for _gidx, (dep_key, dep_data) in enumerate(_groups):
        _is_last_group = _gidx == len(_groups) - 1
        group_items = dep_data["items"]
        primary_item = group_items[0]

        if data.custom_date:
            target_day = data.custom_date
            visit_created_at = datetime.combine(data.custom_date, datetime.now().time())
            initial_queue_status = "yakunlandi"
        else:
            target_day = date.today()
            visit_created_at = datetime.now()

        start = datetime.combine(target_day, datetime.min.time())
        end = datetime.combine(target_day, datetime.max.time())

        svc_obj = db.query(Service).filter(Service.id == primary_item["service_id"]).first()
        svc_cabinet = svc_obj.cabinet if (svc_obj and svc_obj.cabinet) else "1-Xona"
        svc_requires_queue = any(
            (db.query(Service).filter(Service.id == it["service_id"]).first().requires_queue)
            for it in group_items
        ) if not data.custom_date else False

        svc_prefix = dep_data["prefix"]

        if svc_requires_queue:
            ticket_num = _keyingi_raqam(db, svc_prefix, start, end)
            initial_queue_status = "kutmoqda"
        else:
            ticket_num = None
            initial_queue_status = "yakunlandi"

        group_raw_price = sum(it["price"] for it in group_items)

        if total_raw_price > 0 and discount_total > 0:
            if _jami_nishon > 0:
                # Belgilangan xizmatlar bor: chegirma ular orasida ulushga
                # qarab bo'linadi. Oxirgi guruhga qoldiq beriladi, shunda
                # yaxlitlash sababli bir necha so'm yo'qolmaydi.
                nishon = _nishon_summa.get(_gidx, 0)
                if nishon <= 0:
                    group_discount = 0
                elif _gidx == _oxirgi_nishon:
                    group_discount = max(0, discount_total - _allocated_discount)
                else:
                    group_discount = discount_total * nishon // _jami_nishon
                group_discount = min(group_discount, nishon)
            else:
                if _gidx == 0:
                    group_discount = min(discount_total, group_raw_price)
                else:
                    rem_disc = max(0, discount_total - _allocated_discount)
                    group_discount = min(rem_disc, group_raw_price)
        else:
            group_discount = 0
        _allocated_discount += group_discount

        final_group_price = max(0, group_raw_price - group_discount)

        group_cash = 0
        group_card = 0
        group_click = 0
        group_qr = 0
        if data.payment_type in ("split", "aralash"):
            batch_final_total = max(1, total_raw_price - discount_total)
            ratio = final_group_price / batch_final_total
            if _is_last_group:
                group_cash = max(0, (data.cash_amount or 0) - _allocated_cash)
            else:
                raw_cash = (data.cash_amount or 0) * ratio
                group_cash = int(round(raw_cash / 100) * 100)
            group_cash = min(group_cash, final_group_price)
            _allocated_cash += group_cash
            # Naqd bo'lmagan qism Click/QR ga bo'linishi mumkin — ilgari hammasi
            # kartaga yozilib, hisobotda "Karta" bo'lib chiqardi.
            noncash = max(0, final_group_price - group_cash)
            req_click = data.click_amount or 0
            req_qr = data.qr_amount or 0
            req_noncash = (data.card_amount or 0) + req_click + req_qr
            if req_noncash > 0 and (req_click or req_qr):
                group_click = int(noncash * req_click / req_noncash)
                group_qr = int(noncash * req_qr / req_noncash)
                group_card = max(0, noncash - group_click - group_qr)
            else:
                group_card = noncash
        elif data.payment_type in ("cash", "naqd"):
            group_cash = final_group_price
        elif data.payment_type in ("later", "keyinroq", "nasiya", "qarz"):
            pass
        elif data.payment_type in ("click", "payme"):
            group_click = final_group_price
        elif data.payment_type == "qr":
            group_qr = final_group_price
        else:
            group_card = final_group_price

        assigned_provider_id = primary_item.get("provider_id")
        if not assigned_provider_id and svc_obj:
            from models.provider import ProviderService
            ps_link = db.query(ProviderService).filter(ProviderService.service_id == svc_obj.id).first()
            if ps_link:
                assigned_provider_id = ps_link.provider_id
            else:
                svc_cat_lower = (svc_obj.category or "").strip().lower()
                svc_name_lower = (svc_obj.name or "").strip().lower()
                spec_term = svc_cat_lower if (svc_cat_lower and svc_cat_lower != "umumiy") else svc_name_lower
                if spec_term:
                    matched_prov = db.query(Provider).filter(
                        Provider.is_active == True,
                        Provider.specialization.ilike(f"%{spec_term}%")
                    ).first()
                    if matched_prov:
                        assigned_provider_id = matched_prov.id

        patient = Patient(
            first_name=first_name_clean,
            last_name=last_name_clean,
            birth_date=data.birth_date,
            phone=data.phone or "",
            address=data.address,
            referrer_id=data.referrer_id,
            provider_id=assigned_provider_id,
            service_id=primary_item["service_id"],
            payment_amount=final_group_price,
            payment_type=data.payment_type,
            cash_amount=group_cash,
            card_amount=group_card,
            click_amount=group_click,
            qr_amount=group_qr,
            discount_amount=group_discount,
            discount_reason=data.discount_reason,
            created_by=user.id,
            ticket_number=ticket_num,
            queue_status=initial_queue_status,
            cabinet=svc_cabinet,
            created_at=visit_created_at,
            is_paper_entry=bool(data.is_paper_entry or data.custom_date),
        )
        db.add(patient)
        db.flush()
        process_payment(db, patient)
        total_batch_paid += final_group_price

        log_audit(
            db, user_id=user.id, user_role=user.role, action_type="CREATE",
            table_name="patients", record_id=patient.id,
            new_data={"name": f"{patient.first_name} {patient.last_name}"},
            ip_address=ip, device_info=device,
            detail_message=f"Yangi mijoz qo'shildi: {patient.last_name} {patient.first_name}",
        )
        sub_items = []
        services_detail = []
        for it in group_items:
            s_obj = db.query(Service).filter(Service.id == it["service_id"]).first()
            if s_obj:
                qty = it.get("quantity", 1)
                unit = it.get("unit_price") or (it["price"] // max(qty, 1))
                is_c = bool(it.get("is_course", False))
                sub_items.append({
                    "service_name": s_obj.name,
                    "category": s_obj.category or "Umumiy",
                    "price": it["price"],
                    "quantity": qty,
                    "is_course": is_c,
                })
                services_detail.append({
                    "service_id": s_obj.id,
                    "service_name": s_obj.name,
                    "category": s_obj.category or "Umumiy",
                    "quantity": qty,
                    "unit_price": unit,
                    "total_price": it["price"],
                    "is_course": is_c,
                })
                # Har bir xizmatni alohida saqlaymiz. Ilgari faqat guruhning
                # birinchi xizmati (patients.service_id) qolib, qolganlari
                # yo'qolib ketardi.
                db.add(PatientService(
                    patient_id=patient.id,
                    service_id=it["service_id"],
                    quantity=qty,
                    unit_price=unit,
                    total_price=it["price"],
                    is_course=is_c,
                    # Kurs jadvali faqat kursli xizmatga tegishli
                    course_days=(it.get("course_days") or None) if is_c else None,
                ))

        row_dict = _patient_row(patient)
        row_dict["sub_items"] = sub_items
        # Yozuvlar hali flush qilinmagani uchun bog'lanish bo'sh qaytadi —
        # javobga shu yerda to'g'ridan-to'g'ri qo'yamiz.
        row_dict["services"] = services_detail
        created_patients.append(row_dict)

    db.commit()

    # Queue background sync tasks (Google Sheets, Backup URL, Telegram) asynchronously
    patient_ids = [p["id"] for p in created_patients]
    background_tasks.add_task(
        _sync_patient_background,
        patient_ids,
        user.role,
        data.first_name,
        data.last_name or "",
        data.payment_type,
        total_batch_paid,
    )

    if len(created_patients) == 1:
        return created_patients[0]
    return {
        "batch": True,
        "count": len(created_patients),
        "total_amount": total_batch_paid,
        "cash_amount": sum(p.get("cash_amount", 0) for p in created_patients),
        "card_amount": sum(p.get("card_amount", 0) for p in created_patients),
        "patients": created_patients,
    }


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
    user: User = Depends(require_admin_or_ceo),
):
    p = _bemorni_qulflab_ol(db, patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")
    if p.is_cancelled:
        raise HTTPException(status_code=400, detail="Bekor qilingan yozuvni tahrirlab bo'lmaydi")
    # Bog'liq yozuvlar mavjudligini tekshiramiz — ro'yxatga olishda bu bor edi,
    # tahrirlashda esa yo'q edi: mavjud bo'lmagan yo'naltiruvchi bazani
    # "foreign key" xatosi bilan yiqitardi, shifokor esa jimgina yozilib,
    # bemor yo'q doktorga biriktirilardi.
    if data.referrer_id is not None:
        if not db.query(Referrer).filter(Referrer.id == data.referrer_id).first():
            raise HTTPException(status_code=400, detail="Yo'naltiruvchi topilmadi")
    if data.provider_id is not None:
        if not db.query(Provider).filter(Provider.id == data.provider_id).first():
            raise HTTPException(status_code=400, detail="Shifokor topilmadi")

    old = _patient_row(p)
    updates = data.model_dump(exclude_unset=True, exclude={"reason"})
    new_services = updates.pop("services", None)

    # Bu ustunlar bazada BO'SH BO'LMASLIGI shart (NOT NULL). Tahrirlash
    # oynasi to'ldirilmagan maydonni `null` qilib yuboradi — natijada
    # saqlash "serverda xatolik" bilan yiqilardi. Eng ko'p uchragan holat:
    # familiyasi yo'q bemorga (masalan "Rustamboy") yo'naltiruvchi qo'shish.
    # Bo'sh qiymat NULL emas, bo'sh satr bo'lib saqlanadi.
    for maydon in ("first_name", "last_name", "phone", "address"):
        if maydon in updates and updates[maydon] is None:
            updates[maydon] = ""

    # Tahrirlashda ham ism-familiya bosh harf bilan saqlanadi
    for nom_maydoni in ("first_name", "last_name"):
        if nom_maydoni in updates:
            updates[nom_maydoni] = ism_tuzat(updates[nom_maydoni]) or ""

    # Ismsiz bemor bo'lmaydi (familiya bo'lmasligi mumkin)
    if "first_name" in updates and not updates["first_name"]:
        raise HTTPException(status_code=400, detail="Ism bo'sh bo'lishi mumkin emas")

    for k, v in updates.items():
        setattr(p, k, v)

    # Xizmatlar ro'yxati yangilangan bo'lsa — eskisini almashtiramiz va
    # to'lov summasini qaytadan hisoblaymiz (chegirma o'zgarmaydi).
    if new_services is not None:
        if not new_services:
            raise HTTPException(status_code=400, detail="Kamida bitta xizmat bo'lishi kerak")

        # Ilgari bu yerda hamma xizmat yozuvi O'CHIRILIB, qaytadan
        # yaratilardi. Ikki jiddiy muammo bor edi:
        #   1) Kurs yozuviga "keldi" tashrifi bog'langan bo'lsa (prepaid_from_id),
        #      o'chirish tashqi kalitni buzardi va server 500 xato berardi —
        #      ya'ni bugun kelgan bemorga yangi xizmat qo'shib bo'lmasdi.
        #   2) O'chirilib qayta yaratilganda used_count nolga tushardi,
        #      ya'ni bemorning kurs bo'yicha o'tgan kunlari yo'qolardi.
        # Endi mavjud yozuv O'RNIDA yangilanadi.
        mavjud = db.query(PatientService).filter(
            PatientService.patient_id == p.id).all()

        # Qaysi yozuvlarga tashrif bog'langan — ularni o'chirib bo'lmaydi
        bogliq_idlar: set[int] = set()
        if mavjud:
            bogliq_idlar = {
                r[0] for r in db.query(Patient.prepaid_from_id)
                .filter(Patient.prepaid_from_id.in_([x.id for x in mavjud]))
                .distinct().all() if r[0]
            }

        xizmat_boyicha: dict[int, list] = {}
        for x in mavjud:
            xizmat_boyicha.setdefault(x.service_id, []).append(x)

        raw_total = 0
        first_sid = None
        saqlanadi: set[int] = set()
        for it in new_services:
            svc = db.query(Service).filter(Service.id == it["service_id"]).first()
            if not svc:
                raise HTTPException(status_code=400, detail=f"Xizmat topilmadi (ID: {it['service_id']})")
            qty = max(1, int(it.get("quantity") or 1))
            unit = it["price"] if it.get("price") is not None else svc.price
            line = int(unit) * qty
            raw_total += line
            first_sid = first_sid or svc.id
            # None = "aytilmagan": mavjud qiymat saqlanadi. Faqat ataylab
            # true/false yuborilgandagina o'zgaradi.
            _kurs_soralgan = it.get("is_course")
            _kunlar_soralgan = it.get("course_days")

            qator = next(
                (x for x in xizmat_boyicha.get(svc.id, []) if x.id not in saqlanadi),
                None,
            )
            if qator is not None:
                qator.quantity = qty
                qator.unit_price = int(unit)
                qator.total_price = line
                if _kurs_soralgan is not None:
                    qator.is_course = bool(_kurs_soralgan)
                    qator.course_days = (
                        (_kunlar_soralgan or None) if _kurs_soralgan else None)
                elif _kunlar_soralgan is not None and qator.is_course:
                    qator.course_days = _kunlar_soralgan or None
                # Kun soni kamaytirilsa, berilgan seans undan oshib ketmasin
                if int(qator.used_count or 0) > qty:
                    qator.used_count = qty
                saqlanadi.add(qator.id)
            else:
                yangi_kurs = bool(_kurs_soralgan)
                db.add(PatientService(
                    patient_id=p.id, service_id=svc.id,
                    quantity=qty, unit_price=int(unit), total_price=line,
                    is_course=yangi_kurs,
                    course_days=(_kunlar_soralgan or None) if yangi_kurs else None,
                ))

        # Ro'yxatdan chiqarilgan eski yozuvlar
        for x in mavjud:
            if x.id in saqlanadi:
                continue
            if x.id in bogliq_idlar:
                nomi = db.query(Service.name).filter(
                    Service.id == x.service_id).scalar() or "Xizmat"
                raise HTTPException(
                    status_code=400,
                    detail=(f"\"{nomi}\" xizmatini ro'yxatdan olib tashlab "
                            f"bo'lmaydi: bu xizmat bo'yicha allaqachon tashrif "
                            f"qayd etilgan. Avval o'sha tashrifni bekor qiling."),
                )
            db.delete(x)

        p.service_id = first_sid
        # Chegirma xizmatlar jamidan oshmasin
        if (p.discount_amount or 0) > raw_total:
            raise HTTPException(
                status_code=400,
                detail=(f"Chegirma ({p.discount_amount:,} so'm) xizmatlar jamidan "
                        f"({raw_total:,} so'm) katta bo'lishi mumkin emas"),
            )
        p.payment_amount = max(0, raw_total - (p.discount_amount or 0))
        # Naqd/karta taqsimotini yangi summaga moslaymiz
        _apply_payment_split(p, data)
        db.flush()
    elif data.discount_amount is not None:
        # Faqat chegirma o'zgartirilgan bo'lsa — to'lovni mavjud xizmatlardan
        # qaytadan hisoblaymiz
        mavjud = db.query(PatientService).filter(PatientService.patient_id == p.id).all()
        raw_total = sum(int(x.total_price or 0) for x in mavjud) if mavjud else (
            (p.payment_amount or 0) + (old.get("discount_amount") or 0)
        )
        if (p.discount_amount or 0) > raw_total:
            raise HTTPException(
                status_code=400,
                detail=(f"Chegirma ({p.discount_amount:,} so'm) xizmatlar jamidan "
                        f"({raw_total:,} so'm) katta bo'lishi mumkin emas"),
            )
        p.payment_amount = max(0, raw_total - (p.discount_amount or 0))
        _apply_payment_split(p, data)
    else:
        # Xizmatlar ro'yxati alohida yangilanmagan bo'lsa ham payment_type / cash_amount o'zgargan bo'lishi mumkin
        _apply_payment_split(p, data)

    p.updated_at = datetime.now()

    # Pulga ta'sir qiladigan maydon o'zgargan bo'lsa, taqsimotni qaytadan
    # hisoblaymiz. Aks holda (masalan yo'naltiruvchi keyin qo'shilsa) uning
    # ulushi hech qachon hisoblanmay qolardi.
    money_fields = {"referrer_id", "provider_id", "service_id", "payment_amount", "payment_type",
                    "cash_amount", "card_amount", "click_amount", "qr_amount",
                    "discount_amount"}
    if new_services is not None or (money_fields & set(updates.keys())):
        tx = (
            db.query(Transaction)
            .filter(Transaction.patient_id == p.id, Transaction.is_cancelled == False)
            .first()
        )
        if tx:
            reprice_patient_payment(db, p, tx)

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
    p = _bemorni_qulflab_ol(db, patient_id)
    if not p or p.is_cancelled:
        raise HTTPException(status_code=400, detail="Topilmadi yoki bekor qilingan")
    tx = db.query(Transaction).filter(Transaction.patient_id == p.id, Transaction.is_cancelled == False).first()
    if not tx:
        raise HTTPException(status_code=400, detail="Tranzaksiya topilmadi")
    # DIQQAT: tartib muhim. cancel_patient_payment() ichida
    # "patient.is_cancelled bo'lsa rad et" tekshiruvi bor — shuning uchun
    # bayroqni oldindan qo'ysak, pul qaytarish funksiyasi o'z ishini
    # bajarmay xato qaytarardi va bekor qilish umuman ishlamasdi.
    # Avval pulni qaytaramiz, keyin bemorni belgilaymiz.
    cancel_patient_payment(db, p, tx)
    p.is_cancelled = True
    p.cancelled_at = datetime.now()
    p.cancelled_by = user.id          # kim bekor qilgani yozib qo'yiladi
    p.cancel_reason = body.reason
    p.updated_at = datetime.now()
    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="CANCEL",
        table_name="patients", record_id=p.id, reason=body.reason,
        ip_address=ip, device_info=device,
        detail_message=f"To'lov bekor qilindi — sabab: {body.reason}, kim: {user.full_name}",
    )
    db.commit()
    return {"status": "ok"}


@router.post("/{patient_id}/reissue-ticket")
def reissue_ticket(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")
    if p.is_cancelled:
        raise HTTPException(status_code=400, detail="Bekor qilingan bemorga navbat berib bo'lmaydi")

    svc_obj = db.query(Service).filter(Service.id == p.service_id).first()
    svc_prefix = get_queue_prefix_letter(svc_obj)

    today = date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())

    new_ticket_num = _keyingi_raqam(db, svc_prefix, start, end)
    p.ticket_number = new_ticket_num
    p.queue_status = "kutmoqda"
    p.updated_at = datetime.now()

    db.commit()
    db.refresh(p)
    return _patient_row(p)


class PayLaterBody(BaseModel):
    payment_type: str = "naqd"  # naqd | karta | split
    cash_amount: Optional[int] = 0
    card_amount: Optional[int] = 0
    related_patient_ids: Optional[list[int]] = None


@router.post("/{patient_id}/pay-later")
def mark_patient_paid(
    patient_id: int,
    body: PayLaterBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    target_ids = body.related_patient_ids if (body.related_patient_ids and len(body.related_patient_ids) > 0) else [patient_id]
    if patient_id not in target_ids:
        target_ids.append(patient_id)

    patients_to_pay = db.query(Patient).filter(Patient.id.in_(target_ids)).all()
    if not patients_to_pay:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")

    pay_type = body.payment_type if body.payment_type in ("naqd", "karta", "card", "cash", "split", "aralash", "click", "payme", "qr") else "naqd"

    main_patient = next((p for p in patients_to_pay if p.id == patient_id), patients_to_pay[0])

    # Guruh bo'lib to'langanda naqd/karta qismini har bir bemorga ulushiga qarab
    # taqsimlash uchun kerak. Ilgari bu qator yozilmay qolgan edi va aralash yoki
    # guruh to'lovi NameError bilan 500 xato berardi.
    total_all_amount = sum(int(p.payment_amount or 0) for p in patients_to_pay)

    for p in patients_to_pay:
        p.payment_type = pay_type
        amount = p.payment_amount or 0
        if pay_type in ("split", "aralash"):
            if total_all_amount > 0:
                ratio = amount / total_all_amount
                p.cash_amount = int((body.cash_amount or 0) * ratio)
                p.card_amount = max(0, amount - p.cash_amount)
            else:
                p.cash_amount = 0
                p.card_amount = 0
        elif pay_type in ("cash", "naqd"):
            p.cash_amount = amount
            p.card_amount = 0
        elif pay_type in ("click", "payme"):
            if hasattr(p, "click_amount"):
                p.click_amount = amount
            p.cash_amount = 0
            p.card_amount = 0
        elif pay_type == "qr":
            if hasattr(p, "qr_amount"):
                p.qr_amount = amount
            p.cash_amount = 0
            p.card_amount = 0
        else:
            p.cash_amount = 0
            p.card_amount = amount

        p.updated_at = datetime.now()

        tx = db.query(Transaction).filter(Transaction.patient_id == p.id, Transaction.is_cancelled == False).first()
        if tx:
            tx.payment_type = pay_type
            tx.cash_amount = p.cash_amount
            tx.card_amount = p.card_amount
            tx.total_amount = amount
        else:
            process_payment(db, p)

    db.commit()
    db.refresh(main_patient)

    result_row = _patient_row(main_patient)
    if len(patients_to_pay) > 1:
        result_row["batch"] = True
        result_row["total_amount"] = total_all_amount
        result_row["cash_amount"] = sum(p.cash_amount or 0 for p in patients_to_pay)
        result_row["card_amount"] = sum(p.card_amount or 0 for p in patients_to_pay)
        result_row["patients"] = [_patient_row(p) for p in patients_to_pay]

    return {"message": f"Bemor {main_patient.first_name} to'lovi ({pay_type.upper()}) qabul qilindi", "patient": result_row}


@router.get("/{patient_id}/visits")
def patient_visits(patient_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")

    phone_clean = (p.phone or "").strip()
    first_clean = (p.first_name or "").strip().lower()
    last_clean = (p.last_name or "").strip().lower()

    digits_only = "".join(c for c in phone_clean if c.isdigit())
    has_valid_phone = len(digits_only) >= 9

    if has_valid_phone:
        filter_clause = or_(
            Patient.phone == phone_clean,
            (func.lower(Patient.first_name) == first_clean) & (func.lower(Patient.last_name) == last_clean)
        )
    else:
        if first_clean and last_clean:
            filter_clause = (func.lower(Patient.first_name) == first_clean) & (func.lower(Patient.last_name) == last_clean)
        else:
            filter_clause = (Patient.id == p.id)

    visits = (
        db.query(Patient)
        .options(joinedload(Patient.service), joinedload(Patient.provider))
        .filter(filter_clause)
        .order_by(Patient.created_at.desc())
        .all()
    )
    return [
        {
            "id": v.id,
            "first_name": v.first_name,
            "last_name": v.last_name,
            "ticket_number": v.ticket_number,
            "cabinet": v.cabinet,
            "service_name": v.service.name if v.service else None,
            "provider_name": v.provider.full_name if v.provider else None,
            "payment_amount": v.payment_amount,
            "payment_type": v.payment_type,
            "created_at": v.created_at.isoformat(),
            "is_cancelled": v.is_cancelled,
            # Bemor tibbiy kartasida tashrif tarixi bilan birga ko'rsatiladi
            "diagnosis": v.diagnosis,
            "complaints": v.complaints,
            "prescription": v.prescription,
            "discount_amount": v.discount_amount or 0,
            "discount_reason": v.discount_reason,
            # Tashrifda olingan barcha xizmatlar (service_name faqat asosiysi)
            "services": [
                {
                    "service_name": ps.service.name if ps.service else None,
                    "quantity": ps.quantity,
                    "total_price": ps.total_price,
                }
                for ps in (v.services_detail or [])
            ],
        }
        for v in visits
    ]


class MedicalRecordBody(BaseModel):
    diagnosis: str | None = None
    complaints: str | None = None
    prescription: str | None = None


@router.post("/{patient_id}/medical-record")
def save_medical_record(
    patient_id: int,
    body: MedicalRecordBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")

    if body.diagnosis is not None:
        p.diagnosis = body.diagnosis
    if body.complaints is not None:
        p.complaints = body.complaints
    if body.prescription is not None:
        p.prescription = body.prescription

    p.updated_at = datetime.now()
    db.commit()
    db.refresh(p)
    return _patient_row(p)


@router.delete("/{patient_id}")
def delete_patient(
    patient_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_ceo),
):
    from datetime import timedelta
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")

    # Find related patient visits registered together at the exact same time/ticket/phone
    related_patients = [p]
    if p.created_at:
        t_start = p.created_at - timedelta(seconds=120)
        t_end = p.created_at + timedelta(seconds=120)
        others = (
            db.query(Patient)
            .filter(
                Patient.id != p.id,
                Patient.first_name == p.first_name,
                Patient.last_name == p.last_name,
                Patient.created_at >= t_start,
                Patient.created_at <= t_end,
            )
            .all()
        )
        related_patients.extend(others)

    deleted_names = []
    for rp in related_patients:
        # Lower doctor/referrer/center balances if patient was active
        if not rp.is_cancelled:
            tx = db.query(Transaction).filter(Transaction.patient_id == rp.id, Transaction.is_cancelled == False).first()
            if tx:
                cancel_patient_payment(db, rp, tx)

        ip, ua = get_client_info(request)
        log_audit(
            db,
            user_id=user.id,
            user_role=user.role,
            action_type="DELETE_PATIENT",
            table_name="Patient",
            record_id=rp.id,
            detail_message=f"Bemor o'chirildi: {rp.first_name} {rp.last_name} ({rp.phone})",
            ip_address=ip,
            device_info=ua,
        )

        deleted_names.append(f"#{rp.id} ({rp.service.name if rp.service else 'xizmat'})")
        db.query(Transaction).filter(Transaction.patient_id == rp.id).delete()
        db.delete(rp)

    db.commit()
    return {"message": f"Bemor {p.first_name} {p.last_name} va uning barcha bog'liq qabullari ({len(related_patients)} ta xizmat) bazadan to'liq o'chirildi"}


class PayUnpaidServicesBody(BaseModel):
    patient_ids: list[int]
    payment_type: str
    cash_amount: Optional[int] = 0
    card_amount: Optional[int] = 0
    click_amount: Optional[int] = 0
    qr_amount: Optional[int] = 0


@router.get("/{patient_id}/unpaid-services")
def get_unpaid_services(
    patient_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """Bemorning barcha nasiya/to'lanmagan xizmatlari ro'yxatini qaytaradi."""
    target_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not target_patient:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")

    q = db.query(Patient).options(joinedload(Patient.service), joinedload(Patient.provider)).filter(
        Patient.is_cancelled == False,
        Patient.payment_type.in_(["later", "keyinroq", "nasiya", "qarz"]),
    )
    if target_patient.phone and len(target_patient.phone.strip()) > 3:
        q = q.filter(
            or_(
                Patient.id == target_patient.id,
                Patient.phone == target_patient.phone,
            )
        )
    else:
        q = q.filter(
            or_(
                Patient.id == target_patient.id,
                and_(
                    Patient.first_name == target_patient.first_name,
                    Patient.last_name == target_patient.last_name,
                ),
            )
        )

    unpaid = q.order_by(Patient.created_at.desc()).all()
    res = []
    for p in unpaid:
        svc_name = p.service.name if p.service else "Tibbiy Xizmat"
        svc_cat = p.service.category if p.service else "Umumiy"
        prov_name = p.provider.full_name if p.provider else "Shifokor"
        res.append({
            "id": p.id,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "phone": p.phone,
            "service_id": p.service_id,
            "service_name": svc_name,
            "category": svc_cat,
            "provider_name": prov_name,
            "amount": p.payment_amount or 0,
            "registered_at": p.created_at.isoformat() if p.created_at else None,
            "payment_type": p.payment_type,
        })
    return res


@router.post("/{patient_id}/pay-services")
def pay_unpaid_services(
    patient_id: int,
    body: PayUnpaidServicesBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    """
    Nasiya/kechiktirilgan xizmatlar uchun to'lovni bugungi sana bilan qabul qilish,
    to'lov kuni (BUGUN) UZI va xizmatlar hisobotlarida to'liq ko'rinishini ta'minlash hamda chek berish.
    """
    if not body.patient_ids:
        raise HTTPException(status_code=400, detail="Kamida bitta to'lanadigan xizmatni tanlang")

    ptype = body.payment_type.lower()
    ruxsat = ("cash", "card", "click", "qr", "naqd", "karta", "payme", "split", "aralash")
    if ptype not in ruxsat:
        raise HTTPException(status_code=400, detail="Noto'g'ri to'lov turi")

    target_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not target_patient:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")

    selected_records = (
        db.query(Patient)
        .options(joinedload(Patient.service), joinedload(Patient.provider))
        .filter(Patient.id.in_(body.patient_ids), Patient.is_cancelled == False)
        .all()
    )

    if not selected_records:
        raise HTTPException(status_code=404, detail="Tanlangan xizmat yozuvlari topilmadi")

    total_amount = sum(p.payment_amount or 0 for p in selected_records)
    now = datetime.now()

    _allocated_cash = 0
    paid_details = []

    for idx, p in enumerate(selected_records):
        p_price = p.payment_amount or 0
        p_cash = 0
        p_card = 0
        p_click = 0
        p_qr = 0

        if ptype in ("cash", "naqd"):
            p_cash = p_price
        elif ptype in ("click", "payme"):
            p_click = p_price
        elif ptype == "qr":
            p_qr = p_price
        elif ptype in ("split", "aralash"):
            ratio = (p_price / total_amount) if total_amount > 0 else 1.0
            if idx == len(selected_records) - 1:
                p_cash = max(0, (body.cash_amount or 0) - _allocated_cash)
            else:
                p_cash = int(round(((body.cash_amount or 0) * ratio) / 100) * 100)
            p_cash = min(p_cash, p_price)
            _allocated_cash += p_cash

            noncash = max(0, p_price - p_cash)
            req_click = body.click_amount or 0
            req_qr = body.qr_amount or 0
            req_noncash = (body.card_amount or 0) + req_click + req_qr
            if req_noncash > 0 and (req_click or req_qr):
                p_click = int(noncash * req_click / req_noncash)
                p_qr = int(noncash * req_qr / req_noncash)
                p_card = max(0, noncash - p_click - p_qr)
            else:
                p_card = noncash
        else:
            p_card = p_price

        # Update created_at timestamp to TODAY (Payment Date)
        p.payment_type = ptype
        p.cash_amount = p_cash
        p.card_amount = p_card
        p.click_amount = p_click
        p.qr_amount = p_qr
        p.created_at = now
        p.updated_at = now

        # To'lovni ro'yxatga olishdagi bilan BIR XIL yo'l bilan yozamiz.
        #
        # Ilgari bu yerda Transaction qo'lda yaratilardi va ikki jiddiy
        # xatosi bor edi:
        #   1) `amount=` va `created_by=` maydonlari Transaction'da umuman
        #      yo'q — har bir to'lov 500 xato bilan yiqilardi;
        #   2) center_amount / provider_amount / referrer_amount
        #      to'ldirilmasdi, ya'ni shifokor va yo'naltiruvchi ulushi
        #      hisoblanmay qolardi, kassa balansi ham oshmasdi.
        #
        # process_payment shularning hammasini bajaradi: ulushlarni bo'ladi,
        # balanslarni yangilaydi va kassa daftariga yozadi.
        process_payment(db, p)

        paid_details.append({
            "id": p.id,
            "service_name": p.service.name if p.service else "Tibbiy Xizmat",
            "category": p.service.category if p.service else "Umumiy",
            "price": p_price,
            "provider_name": p.provider.full_name if p.provider else "Shifokor",
        })

    db.commit()

    ip, ua = get_client_info(request)
    log_audit(
        db,
        user_id=user.id,
        user_role=user.role,
        action_type="PAY_UNPAID_SERVICES",
        table_name="Patient",
        record_id=target_patient.id,
        detail_message=f"Bemor {target_patient.first_name} {target_patient.last_name} nasiya xizmatlari to'landi ({total_amount:,} so'm)",
        ip_address=ip,
        device_info=ua,
    )

    return {
        "success": True,
        "message": "To'lov muvaffaqiyatli qabul qilindi hamda bugungi hisobotlarga yozildi!",
        "patient_name": f"{target_patient.first_name} {target_patient.last_name}".strip(),
        "ticket_number": target_patient.ticket_number or f"A-{target_patient.id:03d}",
        "payment_date": now.strftime("%d.%m.%Y %H:%M"),
        "payment_type": ptype,
        "total_amount": total_amount,
        "services": paid_details,
    }

