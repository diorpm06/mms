from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session, joinedload

from auth_utils import get_current_user, require_admin_or_ceo, require_doctor_or_admin_or_ceo
from database import get_db
from models.patient import Patient
from models.provider import Provider, ProviderService
from models.payout import Payout
from models.service import Service
from models.transaction import Transaction
from models.user import User

router = APIRouter(prefix="/api/queue", tags=["queue"])


def _navbatni_qulfla(db: Session, patient_id: int):
    """Bemor qatorini QULFLAB o'qiydi (SELECT ... FOR UPDATE).

    Navbat holatini bir vaqtda ikki joydan o'zgartirish mumkin: shifokor
    o'z panelidan, admin esa "Bugungi bemorlar" ro'yxatidan. Qulfsiz
    ikkalasi ham eski holatni ko'rib, biri ikkinchisining o'zgarishini
    bosib ketardi.

    SQLite FOR UPDATE ni qo'llab-quvvatlamaydi — u yerda oddiy o'qish.
    """
    q = db.query(Patient).filter(Patient.id == patient_id)
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        q = q.with_for_update()
    return q.first()


def _assert_patient_ownership(p: Patient, user: User) -> None:
    """Shifokor faqat o'ziga tayinlangan bemorni boshqara oladi; admin/ceo istalganini."""
    if user.role == "doctor" and p.provider_id and user.provider_id and p.provider_id != user.provider_id:
        raise HTTPException(status_code=403, detail="Bu bemor boshqa shifokorga tegishli")

# In-memory pause and shift closed store for doctors
DOCTOR_PAUSE_STATE = {}
DOCTOR_SHIFT_CLOSED_STATE = {}

TICKER_KALITI = "tv_ticker_text"
TICKER_STANDART = (
    "🏥 \"MARJONA MED SERVIS\" KLINIKASIGA XUSH KELIBSIZ! • "
    "SALOMATLIGINGIZ — BIZNING G'AMXO'RLIGIMIZ! • "
    "ALOQA TELEFON: +998 55 604-44-24 • "
    "MANZIL: HAZORASP SENTR • ISH VAQTI: Har kuni 08:00 dan 18:00 gacha"
)


def _ticker_oqi(db: Session) -> str:
    """TV yuguruvchi satri matni — BAZADAN.

    Ilgari u modul darajasidagi oddiy o'zgaruvchida turardi. Vercel'da
    har bir nusxa o'z xotirasiga ega, shuning uchun admin yozgan matn
    faqat bitta nusxada yangilanardi: TV ekran boshqa nusxaga tushsa
    eski matnni ko'rardi va matn ekrandan ekranga sakrab turardi.
    Nusxa qayta ishga tushishi bilan esa standart matnga qaytardi.
    """
    try:
        from models.app_setting import AppSetting

        qator = db.query(AppSetting).filter(
            AppSetting.key == TICKER_KALITI).first()
        if qator and (qator.value or "").strip():
            return qator.value
    except Exception:
        # Jadval hali yaratilmagan bo'lsa ham TV ekran ishlashda davom etsin
        db.rollback()
    return TICKER_STANDART


def _ticker_yoz(db: Session, matn: str) -> str:
    from models.app_setting import AppSetting

    qator = db.query(AppSetting).filter(
        AppSetting.key == TICKER_KALITI).first()
    if qator:
        qator.value = matn
    else:
        db.add(AppSetting(key=TICKER_KALITI, value=matn))
    db.commit()
    return matn


class TickerUpdateBody(BaseModel):
    ticker_text: str


class QueueStatusUpdate(BaseModel):
    queue_status: str  # kutmoqda, qabulda, yakunlandi, o'tkazib yuborildi, bekor
    cabinet: Optional[str] = None


class CallPatientBody(BaseModel):
    cabinet: Optional[str] = "Qabulxona"


def _format_patient_queue_item(p: Patient, public: bool = False) -> dict:
    created_dt = p.created_at or datetime.now()
    created_str = created_dt.isoformat()
    if not created_str.endswith("Z"):
        created_str += "Z"

    updated_dt = p.updated_at or p.created_at or datetime.now()
    updated_str = updated_dt.isoformat()
    if not updated_str.endswith("Z"):
        updated_str += "Z"

    # TV taxtasi (public=True) internetda autentifikatsiyasiz ochiq. Bemorni
    # chaqirish uchun ismi kerak, lekin familiyani to'liq va qaysi tahlil
    # topshirganini ochiq ko'rsatish — tibbiy maxfiylik buzilishi. Shuning
    # uchun jamoat ko'rinishida familiya qisqartiriladi.
    last_name_display = p.last_name
    if public and (p.last_name or "").strip():
        last_name_display = f"{p.last_name.strip()[0]}."

    cab = None
    if p.service and p.service.cabinet and p.service.cabinet.strip() not in ("-", "", "None"):
        cab = p.service.cabinet.strip()
    elif p.cabinet and p.cabinet.strip() not in ("-", "", "None"):
        cab = p.cabinet.strip()
    elif p.provider and getattr(p.provider, 'cabinet', None) and p.provider.cabinet and p.provider.cabinet.strip() not in ("-", "", "None"):
        cab = p.provider.cabinet.strip()
    elif p.service and "laborat" in (p.service.category or "").lower():
        cab = "Laboratoriya"
    elif p.provider and p.provider.specialization:
        cab = p.provider.specialization
    else:
        cab = "1-Xona"

    item = {
        "id": p.id,
        "first_name": p.first_name,
        "last_name": last_name_display,
        "ticket_number": p.ticket_number or f"A-{p.id:03d}",
        "queue_status": p.queue_status or "kutmoqda",
        "cabinet": cab,
        "created_at": created_str,
        "updated_at": updated_str,
        "provider_id": p.provider_id,
        "provider_name": p.provider.full_name if p.provider else None,
        "provider_specialization": p.provider.specialization if p.provider else None,
        "service_id": p.service_id,
        # Jamoat ko'rinishida aniq tahlil nomi ("Gepatit B tahlili") o'rniga
        # faqat bo'lim ("Laboratoriya") beriladi — TV "Navbat turi" shu bilan
        # ishlaydi, lekin bemorning tashxisi oshkor bo'lmaydi.
        "service_name": (
            # Kategoriya "Laboratoriya: KOAGULOGRAMMA" ko'rinishida ham bo'lishi
            # mumkin — jamoat ko'rinishi uchun faqat bosh qismini olamiz.
            ((p.service.category or "Umumiy").split(":")[0].strip() or "Umumiy")
            if (public and p.service)
            else (p.service.name if p.service else None)
        ),
        "service_category": p.service.category if p.service else None,
        "template_key": p.service.template_key if p.service else None,
    }

    if not public:
        # PII — faqat tizimga kirgan xodimlar uchun (TV navbat taxtasida ko'rsatilmaydi)
        item["phone"] = p.phone or "Kiritilmagan"
        item["birth_date"] = p.birth_date.isoformat() if p.birth_date else None
        item["address"] = p.address or "Ko'rsatilmagan"
        item["payment_amount"] = p.payment_amount or 0
        item["payment_type"] = p.payment_type or "naqd"

    return item


@router.get("/live")
def get_live_queue(db: Session = Depends(get_db)):
    """
    Public endpoint for TV Display Board.
    Returns current active queue items for today.
    """
    today = date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())

    patients = (
        db.query(Patient)
        .options(
            joinedload(Patient.provider),
            joinedload(Patient.service),
        )
        .filter(
            # Faqat BUGUNGI bemorlar. Ilgari "kutmoqda"/"qabulda" holati sana
            # cheklovisiz OR bilan tekshirilardi — natijada yakunlanmagan eski
            # bemorlar TV taxtasida kunlar davomida osilib qolardi.
            Patient.is_cancelled == False,
            Patient.created_at >= start,
            Patient.created_at <= end,
        )
        .all()
    )

    calling = []
    waiting = []
    finished = []

    for p in patients:
        status = p.queue_status or "kutmoqda"
        item = _format_patient_queue_item(p, public=True)
        if status == "qabulda":
            calling.append(item)
        elif status == "kutmoqda":
            waiting.append(item)
        elif status == "yakunlandi":
            finished.append(item)

    # Sort calling by updated_at desc (most recently called first)
    calling.sort(key=lambda x: x["updated_at"], reverse=True)
    # Sort waiting by created_at asc (first come first served)
    waiting.sort(key=lambda x: x["created_at"])
    # Sort finished by updated_at desc (most recently finished first)
    finished.sort(key=lambda x: x["updated_at"], reverse=True)

    return {
        "timestamp": datetime.now().isoformat(),
        "ticker_text": _ticker_oqi(db),
        "stats": {
            "total": len(patients),
            "calling": len(calling),
            "waiting": len(waiting),
            "finished": len(finished),
        },
        "calling": calling,
        "waiting": waiting,
        "finished": finished[:8],
    }


@router.post("/ticker")
def update_queue_ticker(
    data: TickerUpdateBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    if not (data.ticker_text and data.ticker_text.strip()):
        raise HTTPException(status_code=400, detail="Matn bo'sh bo'lishi mumkin emas")
    matn = _ticker_yoz(db, data.ticker_text.strip())
    return {"ticker_text": matn,
            "message": "TV matni yangilandi va barcha ekranlarga uzatildi"}


@router.get("/pending-payments")
def get_pending_payments(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """
    Returns active pending/unpaid payment reminders for today.
    Used by bottom-right floating payment alert widget.
    """
    today = date.today()
    start = datetime.combine(today, datetime.min.time())

    # Patients registered with payment_type in ('later', 'keyinroq', 'nasiya', 'qarz')
    patients = (
        db.query(Patient)
        .options(joinedload(Patient.service), joinedload(Patient.provider))
        .filter(
            Patient.is_cancelled == False,
            Patient.created_at >= start,
            Patient.payment_type.in_(["later", "keyinroq", "nasiya", "qarz"]),
        )
        .order_by(Patient.created_at.desc())
        .all()
    )

    # Group by patient identity: (first_name, last_name, phone)
    grouped = {}
    for p in patients:
        fn = (p.first_name or "").strip().lower()
        ln = (p.last_name or "").strip().lower()
        ph = (p.phone or "").strip()
        key = f"{fn}_{ln}_{ph}" if ph and ph != "Kiritilmagan" else f"{fn}_{ln}_{p.id}"

        if key not in grouped:
            grouped[key] = []
        grouped[key].append(p)

    items = []
    for key, p_list in grouped.items():
        first_p = p_list[0]
        total_amount = sum(p.payment_amount or 0 for p in p_list)
        tickets = [p.ticket_number or f"A-{p.id:03d}" for p in p_list]
        unique_tickets = list(dict.fromkeys(tickets))
        tickets_str = ", ".join(unique_tickets)

        breakdown = []
        for p in p_list:
            svc_name = p.service.name if p.service else "Tibbiy Xizmat"
            prov_name = p.provider.full_name if p.provider else "Shifokor / Qabulxona"
            svc_cat = p.service.category if p.service and p.service.category else "Umumiy"

            item_display_name = svc_name
            if p.diagnosis:
                diag = p.diagnosis.strip()
                if diag.startswith("Sarflangan Material (") and diag.endswith(")"):
                    item_display_name = diag[21:-1].strip()
                elif diag.startswith("Material: "):
                    item_display_name = diag[10:].strip()
                elif p.diagnosis != svc_name and p.queue_status == "yakunlandi":
                    item_display_name = diag

            breakdown.append({
                "patient_id": p.id,
                "title": item_display_name,
                "service_name": item_display_name,
                "category": svc_cat if svc_cat != "Ombor Materiali" else "Umumiy",
                "provider_name": prov_name,
                "price": p.payment_amount or 0,
                "quantity": 1,
                "ticket_number": p.ticket_number or f"A-{p.id:03d}",
            })

        reasons = [f"{b['title']} ({b['provider_name']})" for b in breakdown]
        reason_str = " + ".join(reasons)

        items.append({
            "id": first_p.id,
            "patient_id": first_p.id,
            "related_patient_ids": [p.id for p in p_list],
            "ticket_number": tickets_str,
            "first_name": first_p.first_name,
            "last_name": first_p.last_name,
            "full_name": f"{first_p.first_name} {first_p.last_name}".strip(),
            "phone": first_p.phone or "Kiritilmagan",
            "address": first_p.address,
            "birth_date": first_p.birth_date.isoformat() if first_p.birth_date else None,
            "reason": reason_str,
            "service_name": first_p.service.name if first_p.service else "Xizmat",
            "provider_name": first_p.provider.full_name if first_p.provider else "Shifokor",
            "cabinet": first_p.cabinet,
            "amount": total_amount,
            "payment_type": first_p.payment_type,
            "created_at": first_p.created_at.isoformat() if first_p.created_at else datetime.now().isoformat(),
            "breakdown": breakdown,
        })

    return items



@router.get("/doctor/my-queue")
def get_doctor_queue(
    provider_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    """
    Get current queue dashboard data & history for logged-in Doctor.
    """
    if user.role == "doctor" and user.provider_id:
        target_provider_id = user.provider_id
    else:
        target_provider_id = provider_id or user.provider_id

    # Auto-link user -> provider if user.role == 'doctor' and user.provider_id is None
    if not target_provider_id and user.role == "doctor":
        prov = db.query(Provider).filter(
            or_(
                Provider.full_name.ilike(f"%{user.full_name}%"),
                Provider.id == user.id
            )
        ).first()
        if prov:
            target_provider_id = prov.id
            user.provider_id = prov.id
            db.commit()

    provider = None
    if target_provider_id:
        provider = db.query(Provider).filter(Provider.id == target_provider_id).first()

    today = date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())

    query = db.query(Patient).options(
        joinedload(Patient.provider),
        joinedload(Patient.service),
    ).filter(
        Patient.created_at >= start,
        Patient.created_at <= end,
        Patient.is_cancelled == False,
    )
    if target_provider_id:
        doc_services = db.query(ProviderService).filter(ProviderService.provider_id == target_provider_id).all()
        doc_service_ids = [s.service_id for s in doc_services]
        
        spec = (provider.specialization or "").strip().lower() if provider else ""
        spec_clean = spec.replace("xona", "").replace("vrach", "").replace("shifokor", "").replace("shifokori", "").strip()

        matching_conditions = [Patient.provider_id == target_provider_id]
        if doc_service_ids:
            matching_conditions.append(
                and_(or_(Patient.provider_id == None, Patient.provider_id == target_provider_id), Patient.service_id.in_(doc_service_ids))
            )
        if spec_clean:
            # Map common medical specializations
            terms = [spec_clean]
            if "kardio" in spec_clean:
                terms.extend(["kardio", "yurak"])
            elif "nevro" in spec_clean:
                terms.extend(["nevro", "asab"])
            elif "uzi" in spec_clean or "ultra" in spec_clean:
                terms.extend(["uzi", "ultratovush"])
            elif "lab" in spec_clean or "analiz" in spec_clean:
                terms.extend(["lab", "analiz", "tahlil"])
            elif "ozon" in spec_clean:
                terms.extend(["ozon", "ozonoterap", "ozonaterap"])
            elif "ineks" in spec_clean or "ukol" in spec_clean or "muolaj" in spec_clean or "sistem" in spec_clean or "tomchi" in spec_clean:
                terms.extend(["ineks", "ukol", "sistem", "tomchi", "muolaj", "injekt"])
            elif "pediatr" in spec_clean or "bosh" in spec_clean:
                terms.extend(["pediatr", "bosh"])
            elif "lor" in spec_clean:
                terms.extend(["lor", "quloq"])
            elif "stomat" in spec_clean or "tish" in spec_clean:
                terms.extend(["stomat", "tish"])
            elif "ginekolog" in spec_clean or "ayol" in spec_clean:
                terms.extend(["ginekolog", "ayol"])
            elif "terapevt" in spec_clean:
                terms.extend(["terapevt", "umumiy"])

            for t in terms:
                matching_conditions.append(
                    and_(
                        or_(Patient.provider_id == None, Patient.provider_id == target_provider_id),
                        Patient.service.has(
                            or_(
                                Service.category.ilike(f"%{t}%"),
                                Service.name.ilike(f"%{t}%")
                            )
                        )
                    )
                )
        query = query.filter(or_(*matching_conditions))

    patients = query.all()

    current_patient = None
    waiting_list = []
    history_list = []
    completed_today = 0
    skipped_today = 0

    for p in patients:
        item = _format_patient_queue_item(p)
        status = p.queue_status or "kutmoqda"
        if status == "qabulda":
            current_patient = item
        elif status == "kutmoqda":
            waiting_list.append(item)
        elif status in ("yakunlandi", "o'tkazib yuborildi"):
            history_list.append(item)
            if status == "yakunlandi":
                completed_today += 1
            else:
                skipped_today += 1

    waiting_list.sort(key=lambda x: x["created_at"])
    history_list.sort(key=lambda x: x["updated_at"], reverse=True)

    pause_key = target_provider_id or user.id
    is_paused = DOCTOR_PAUSE_STATE.get(pause_key, False)
    is_shift_closed = DOCTOR_SHIFT_CLOSED_STATE.get(pause_key, False)

    today_kpi_earned = 0
    today_gross_revenue = 0
    kpi_breakdown = []
    if provider:
        today_txs = (
            db.query(Transaction)
            .options(joinedload(Transaction.patient).joinedload(Patient.service))
            .filter(
                Transaction.provider_id == provider.id,
                Transaction.is_cancelled == False,
                Transaction.created_at >= start,
                Transaction.created_at <= end,
            )
            .order_by(Transaction.created_at.desc())
            .all()
        )
        for t in today_txs:
            p_obj = t.patient
            earned = int(t.provider_amount or 0)
            today_kpi_earned += earned
            today_gross_revenue += int(t.total_amount or 0)
            if p_obj:
                kpi_breakdown.append({
                    "patient_id": p_obj.id,
                    "patient_name": f"{p_obj.first_name} {p_obj.last_name}".strip(),
                    "ticket_number": p_obj.ticket_number or f"A-{p_obj.id:03d}",
                    "service_name": p_obj.service.name if p_obj.service else "Xizmat",
                    "total_amount": int(t.total_amount or 0),
                    "provider_amount": earned,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                })

    # Return provider's active balance (which holds today's accumulated KPI)
    current_balance = int(provider.balance or 0) if provider else 0

    # Bir odam ham shifokor, ham yo'naltiruvchi bo'lishi mumkin
    # ("Dr.Ozoda" va "Ozoda Medsestra"). Yo'naltirishdan tushgan puli
    # shifokorlik ulushidan ALOHIDA ko'rsatiladi — ular turli ish uchun.
    referral = {"name": None, "today": 0, "total": 0, "balance": 0}
    if provider is not None and getattr(provider, "referrer_id", None):
        from models.referrer import Referrer

        ref = db.query(Referrer).filter(
            Referrer.id == provider.referrer_id).first()
        if ref:
            bugun_boshi = datetime.combine(date.today(), datetime.min.time())
            bugun_oxiri = datetime.combine(date.today(), datetime.max.time())
            referral = {
                "name": ref.full_name,
                "today": int(db.query(func.coalesce(
                    func.sum(Transaction.referrer_amount), 0)).filter(
                    Transaction.referrer_id == ref.id,
                    Transaction.is_cancelled == False,  # noqa: E712
                    Transaction.created_at >= bugun_boshi,
                    Transaction.created_at <= bugun_oxiri).scalar() or 0),
                "total": int(db.query(func.coalesce(
                    func.sum(Transaction.referrer_amount), 0)).filter(
                    Transaction.referrer_id == ref.id,
                    Transaction.is_cancelled == False).scalar() or 0),  # noqa: E712
                "balance": int(ref.balance or 0),
            }

    return {
        "user_id": user.id,
        "doctor_name": provider.full_name if provider else user.full_name,
        "provider_id": provider.id if provider else None,
        "specialization": provider.specialization if provider else "Shifokor",
        "cabinet": (provider.specialization + " Xonasi") if provider else "1-Xona",
        "is_paused": is_paused,
        "is_shift_closed": is_shift_closed,
        "stats": {
            "completed": completed_today,
            "skipped": skipped_today,
            "waiting": len(waiting_list),
            "total_today": len(patients),
            "today_kpi_earned": today_kpi_earned,
            "today_gross_revenue": today_gross_revenue,
            "current_balance": current_balance,
            "kpi_percentage": int(provider.percentage or 0) if provider else 0,
            "kpi_breakdown": kpi_breakdown,
            # Yo'naltirishdan tushgan puli (bog'langan bo'lsa)
            "referrer_name": referral["name"],
            "referral_today": referral["today"],
            "referral_total": referral["total"],
            "referral_balance": referral["balance"],
        },
        "current_patient": current_patient,
        "waiting_list": waiting_list,
        "history_list": history_list,
    }


@router.post("/doctor/toggle-pause")
def toggle_doctor_pause(
    provider_id: Optional[int] = None,
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    pause_key = provider_id or user.id
    current = DOCTOR_PAUSE_STATE.get(pause_key, False)
    DOCTOR_PAUSE_STATE[pause_key] = not current
    return {"is_paused": DOCTOR_PAUSE_STATE[pause_key], "message": "Pauza holati yangilandi"}


@router.post("/doctor/toggle-shift")
def toggle_doctor_shift(
    provider_id: Optional[int] = None,
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    shift_key = provider_id or user.id
    current = DOCTOR_SHIFT_CLOSED_STATE.get(shift_key, False)
    DOCTOR_SHIFT_CLOSED_STATE[shift_key] = not current
    status_str = "yakunlandi (Qabul yopildi)" if DOCTOR_SHIFT_CLOSED_STATE[shift_key] else "qayta ochildi (Qabul ochiq)"
    return {"is_shift_closed": DOCTOR_SHIFT_CLOSED_STATE[shift_key], "message": f"Bugungi ish kuni {status_str}"}


class CallNextBody(BaseModel):
    cabinet: Optional[str] = None
    provider_id: Optional[int] = None


@router.post("/doctor/call-next")
def doctor_call_next(
    body: Optional[CallNextBody] = None,
    provider_id: Optional[int] = None,
    cabinet: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    target_provider_id = (body.provider_id if body and body.provider_id else None) or provider_id or user.provider_id
    target_cabinet = (body.cabinet if body and body.cabinet else None) or cabinet

    today = date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())

    query = db.query(Patient).filter(
        Patient.created_at >= start,
        Patient.created_at <= end,
        Patient.is_cancelled == False,
        Patient.queue_status == "kutmoqda",
    )

    # Auto-complete any existing patient currently in "qabulda" for this doctor
    cur_query = db.query(Patient).filter(
        Patient.created_at >= start,
        Patient.created_at <= end,
        Patient.is_cancelled == False,
        Patient.queue_status == "qabulda",
    )
    if target_provider_id:
        cur_query = cur_query.filter(Patient.provider_id == target_provider_id)
    for cp in cur_query.all():
        cp.queue_status = "yakunlandi"
        cp.updated_at = datetime.now()

    provider = db.query(Provider).filter(Provider.id == target_provider_id).first() if target_provider_id else None

    if target_provider_id:
        doc_services = db.query(ProviderService).filter(ProviderService.provider_id == target_provider_id).all()
        doc_service_ids = [s.service_id for s in doc_services]
        spec = (provider.specialization or "").strip().lower() if provider else ""
        spec_clean = spec.replace("xona", "").replace("vrach", "").replace("shifokor", "").replace("shifokori", "").strip()

        matching_conditions = [Patient.provider_id == target_provider_id]
        if doc_service_ids:
            matching_conditions.append(
                and_(or_(Patient.provider_id == None, Patient.provider_id == target_provider_id), Patient.service_id.in_(doc_service_ids))
            )
        if spec_clean:
            terms = [spec_clean]
            if "kardio" in spec_clean:
                terms.extend(["kardio", "yurak"])
            elif "nevro" in spec_clean:
                terms.extend(["nevro", "asab"])
            elif "uzi" in spec_clean or "ultra" in spec_clean:
                terms.extend(["uzi", "ultratovush"])
            elif "lab" in spec_clean or "analiz" in spec_clean:
                terms.extend(["lab", "analiz", "tahlil"])
            elif "ozon" in spec_clean:
                terms.extend(["ozon", "ozonoterap", "ozonaterap"])
            elif "ineks" in spec_clean or "ukol" in spec_clean or "muolaj" in spec_clean or "sistem" in spec_clean or "tomchi" in spec_clean:
                terms.extend(["ineks", "ukol", "sistem", "tomchi", "muolaj", "injekt"])
            elif "pediatr" in spec_clean or "bosh" in spec_clean:
                terms.extend(["pediatr", "bosh"])
            elif "lor" in spec_clean:
                terms.extend(["lor", "quloq"])
            elif "stomat" in spec_clean or "tish" in spec_clean:
                terms.extend(["stomat", "tish"])
            elif "ginekolog" in spec_clean or "ayol" in spec_clean:
                terms.extend(["ginekolog", "ayol"])
            elif "terapevt" in spec_clean:
                terms.extend(["terapevt", "umumiy"])

            for t in terms:
                matching_conditions.append(
                    and_(
                        or_(Patient.provider_id == None, Patient.provider_id == target_provider_id),
                        Patient.service.has(
                            or_(
                                Service.category.ilike(f"%{t}%"),
                                Service.name.ilike(f"%{t}%")
                            )
                        )
                    )
                )
        query = query.filter(or_(*matching_conditions))

    # Bir vaqtda ikki shifokor "Keyingisi" bossa, ikkalasi ham bitta
    # bemorni tanlab olardi: SELECT ikkalasida ham o'sha qatorni qaytarardi
    # va keyin ikkalasi ham uni "qabulda" qilib yozardi. Natijada bemor
    # ikki xonaga chaqirilardi, TV ekranda esa bittasi yo'qolardi.
    #
    # FOR UPDATE SKIP LOCKED: birinchi shifokor qatorni qulflaydi, ikkinchisi
    # uni KUTMASDAN o'tkazib yuboradi va keyingi bemorni oladi. Aynan
    # navbat taqsimlash uchun mo'ljallangan usul.
    #
    # SQLite qulflashni qo'llab-quvvatlamaydi — u yerda oddiy o'qish.
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        query = query.with_for_update(skip_locked=True)

    next_patient = query.order_by(Patient.created_at.asc()).first()

    if not next_patient:
        db.commit()
        return {"message": "Qabul yakunlandi. Navbatda boshqa mijoz yo'q", "patient": None, "has_next": False}

    assigned_cabinet = target_cabinet or (f"{provider.specialization} Xonasi" if provider else "1-Xona")

    if target_provider_id and not next_patient.provider_id:
        next_patient.provider_id = target_provider_id

    next_patient.queue_status = "qabulda"
    next_patient.cabinet = assigned_cabinet
    next_patient.updated_at = datetime.now()

    db.commit()
    db.refresh(next_patient)
    return {"message": f"Navbat {next_patient.ticket_number} chaqirildi", "patient": _format_patient_queue_item(next_patient), "has_next": True}


@router.post("/doctor/recall-current")
def recall_current_patient(
    body: Optional[CallNextBody] = None,
    provider_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    target_provider_id = (body.provider_id if body and body.provider_id else None) or provider_id or user.provider_id

    query = db.query(Patient).filter(
        Patient.is_cancelled == False,
        Patient.queue_status == "qabulda",
    )
    if target_provider_id:
        query = query.filter(Patient.provider_id == target_provider_id)

    cur_p = query.order_by(Patient.updated_at.desc()).first()
    if not cur_p and user.role != "doctor":
        cur_p = db.query(Patient).filter(
            Patient.is_cancelled == False,
            Patient.queue_status == "qabulda"
        ).order_by(Patient.updated_at.desc()).first()

    if not cur_p:
        return {"message": "Qayta chaqirish uchun qabulda bemor topilmadi", "patient": None}

    cur_p.updated_at = datetime.now()
    db.commit()
    db.refresh(cur_p)
    return {"message": f"Bemor {cur_p.ticket_number} qayta chaqirildi", "patient": _format_patient_queue_item(cur_p)}


@router.post("/{patient_id}/recall")
def recall_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    p = _navbatni_qulfla(db, patient_id)
    if not p and user.role != "doctor":
        p = db.query(Patient).filter(Patient.is_cancelled == False, Patient.queue_status == "qabulda").order_by(Patient.updated_at.desc()).first()
    if not p:
        return {"message": "Qayta chaqirish uchun qabulda bemor topilmadi", "patient": None}

    _assert_patient_ownership(p, user)
    p.queue_status = "qabulda"
    p.updated_at = datetime.now()

    db.commit()
    db.refresh(p)
    return {"message": f"Bemor {p.ticket_number} qayta chaqirildi", "patient": _format_patient_queue_item(p)}


@router.post("/{patient_id}/status")
def update_patient_queue_status(
    patient_id: int,
    data: QueueStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    p = _navbatni_qulfla(db, patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")
    if p.is_cancelled:
        raise HTTPException(status_code=400, detail="Bekor qilingan mijoz navbatini o'zgartirib bo'lmaydi")
    _assert_patient_ownership(p, user)

    valid_statuses = ["kutmoqda", "qabulda", "yakunlandi", "o'tkazib yuborildi"]
    if data.queue_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Noto'g'ri navbat holati")

    p.queue_status = data.queue_status
    if data.cabinet is not None:
        p.cabinet = data.cabinet
    p.updated_at = datetime.now()

    db.commit()
    db.refresh(p)
    return {"message": "Navbat holati yangilandi", "patient": _format_patient_queue_item(p)}


@router.post("/{patient_id}/complete")
def complete_patient_visit(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    p = _navbatni_qulfla(db, patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")
    _assert_patient_ownership(p, user)

    p.queue_status = "yakunlandi"
    p.updated_at = datetime.now()

    db.commit()
    db.refresh(p)
    return {"message": f"Mijoz {p.ticket_number} qabuli yakunlandi", "patient": _format_patient_queue_item(p)}


@router.post("/{patient_id}/skip")
def skip_patient_visit(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    p = _navbatni_qulfla(db, patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")
    _assert_patient_ownership(p, user)

    p.queue_status = "o'tkazib yuborildi"
    p.updated_at = datetime.now()

    db.commit()
    db.refresh(p)
    return {"message": f"Mijoz {p.ticket_number} o'tkazib yuborildi", "patient": _format_patient_queue_item(p)}


@router.post("/{patient_id}/call")
def call_patient(
    patient_id: int,
    data: CallPatientBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    p = _navbatni_qulfla(db, patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")
    if p.is_cancelled:
        raise HTTPException(status_code=400, detail="Bekor qilingan mijozni chaqirib bo'lmaydi")
    _assert_patient_ownership(p, user)

    p.queue_status = "qabulda"
    if data.cabinet:
        p.cabinet = data.cabinet
    p.updated_at = datetime.now()

    db.commit()
    db.refresh(p)
    return {"message": f"Mijoz {p.ticket_number} {p.cabinet} ga chaqirildi", "patient": _format_patient_queue_item(p)}
