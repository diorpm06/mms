"""Oldindan to'langan ko'p kunlik xizmatlar (kurslar).

Bemor bir necha kunlik xizmatni oldindan to'laydi (masalan 4 ta elektroforez).
Keyingi kunlarda kelganda "Keldi" bosiladi: qayta pul olinmaydi, navbat raqami
beriladi va qolgan kun kamayadi.

MUHIM: kurs ODAM + XIZMAT bo'yicha yig'iladi, alohida yozuv bo'yicha emas.
Xodim 4 kunni bir yozuvda (4) ham, ikki yozuvda (1 + 3) ham kiritishi mumkin —
ikkalasi ham bir xil kurs deb qaraladi. Ilgari har bir yozuv alohida
sanalgani uchun "1 + 3" ko'rinishida kiritilganda bir kun yo'qolardi.
"""
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from auth_utils import require_admin_or_ceo
from database import get_db
from models.patient import Patient
from models.patient_service import PatientService
from models.service import Service
from models.user import User
from services.audit import get_client_info, log_audit

router = APIRouter(prefix="/api/courses", tags=["courses"])


def _odam_kaliti(p: Patient) -> str:
    """Bir odamni tanish uchun kalit.

    Har bir tashrif alohida Patient qatori bo'lgani uchun ism yoki telefon
    bo'yicha birlashtiramiz. Telefon ko'pincha bo'sh bo'ladi — shunda
    ism/familiya va tug'ilgan sana ishlatiladi (hisobotlardagi bilan bir xil).
    """
    tel = (p.phone or "").strip()
    if tel and tel != "+998":
        return "tel:" + tel
    return "ism:%s|%s|%s" % (
        (p.first_name or "").strip().lower(),
        (p.last_name or "").strip().lower(),
        p.birth_date,
    )


def _kurslarni_yig(db: Session, faqat_tugallanmagan: bool = True,
                   odam_kaliti: str | None = None) -> list[dict]:
    """Barcha ko'p kunlik to'lovlarni odam+xizmat bo'yicha birlashtiradi."""
    qatorlar = (
        db.query(PatientService, Patient)
        .join(Patient, Patient.id == PatientService.patient_id)
        .options(joinedload(PatientService.service))
        .filter(
            Patient.is_cancelled == False,          # noqa: E712
            Patient.prepaid_from_id.is_(None),      # kurs tashrifi emas, asl to'lov
        )
        .order_by(Patient.created_at.asc())
        .all()
    )

    guruh: dict[tuple, dict] = {}
    for ps, p in qatorlar:
        kalit = (_odam_kaliti(p), ps.service_id)
        if odam_kaliti and kalit[0] != odam_kaliti:
            continue
        g = guruh.get(kalit)
        if g is None:
            g = {
                "key": "%s::%s" % (kalit[0], ps.service_id),
                "patient_id": p.id,
                "patient_name": f"{p.first_name} {p.last_name}".strip(),
                "phone": p.phone,
                "provider_id": p.provider_id,
                "service_id": ps.service_id,
                "service_name": ps.service.name if ps.service else None,
                "category": ps.service.category if ps.service else None,
                "unit_price": int(ps.unit_price or 0),
                "total_price": 0,
                "quantity": 0,
                "used_count": 0,
                "started_at": p.created_at.isoformat() if p.created_at else None,
                "tickets": [],
                "_rows": [],
            }
            guruh[kalit] = g
        g["quantity"] += int(ps.quantity or 1)
        g["used_count"] += int(ps.used_count if ps.used_count is not None else 1)
        g["total_price"] += int(ps.total_price or 0)
        if p.ticket_number:
            g["tickets"].append(p.ticket_number)
        g["_rows"].append(ps)

    natija = []
    for g in guruh.values():
        g["remaining"] = max(0, g["quantity"] - g["used_count"])
        if faqat_tugallanmagan and (g["quantity"] < 2 or g["remaining"] <= 0):
            continue
        natija.append(g)

    natija.sort(key=lambda x: x["started_at"] or "", reverse=True)
    return natija


def _tozala(g: dict) -> dict:
    return {k: v for k, v in g.items() if not k.startswith("_")}


def _kursni_top(db: Session, kalit: str) -> dict:
    try:
        odam, svc_id = kalit.rsplit("::", 1)
        svc_id = int(svc_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Kurs kaliti noto'g'ri")

    for g in _kurslarni_yig(db, faqat_tugallanmagan=False, odam_kaliti=odam):
        if g["service_id"] == svc_id:
            return g
    raise HTTPException(status_code=404, detail="Kurs topilmadi")


@router.get("")
def list_active_courses(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """Hali tugamagan kurslar — kuni qolgan bemorlar."""
    return [_tozala(g) for g in _kurslarni_yig(db)]


@router.post("/use")
def use_session(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    """Bemor navbatdagi kuniga keldi: qayta to'lov OLINMAYDI, navbatga qo'yiladi."""
    kalit = (body or {}).get("key")
    if not kalit:
        raise HTTPException(status_code=400, detail="Kurs ko'rsatilmagan")

    g = _kursni_top(db, kalit)
    if g["remaining"] <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"Bu kurs tugagan: {g['quantity']} kundan {g['used_count']} tasi ishlatilgan.",
        )

    asl = db.query(Patient).filter(Patient.id == g["patient_id"]).first()
    if not asl:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")

    # Shu odam bugun shu xizmat bo'yicha allaqachon kelganmi
    bugun_boshi = datetime.combine(date.today(), datetime.min.time())
    idlar = [ps.id for ps in g["_rows"]]
    bor = (
        db.query(Patient)
        .filter(
            Patient.prepaid_from_id.in_(idlar),
            Patient.created_at >= bugun_boshi,
            Patient.is_cancelled == False,  # noqa: E712
        )
        .first()
    )
    if bor:
        raise HTTPException(
            status_code=400,
            detail=f"Bu bemor bugun shu xizmat bo'yicha allaqachon qabul qilingan ({bor.ticket_number}).",
        )

    # Bo'sh o'rni qolgan birinchi yozuvni ishlatamiz
    nishon = None
    for ps in g["_rows"]:
        if int(ps.used_count if ps.used_count is not None else 1) < int(ps.quantity or 1):
            nishon = ps
            break
    if nishon is None:
        raise HTTPException(status_code=400, detail="Bo'sh kun qolmagan")

    svc = db.query(Service).filter(Service.id == g["service_id"]).first()

    from routers.patients import _keyingi_raqam, get_queue_prefix_letter

    prefiks = get_queue_prefix_letter(svc)
    ticket = _keyingi_raqam(db, prefiks, bugun_boshi,
                            datetime.combine(date.today(), datetime.max.time()))

    # To'lov 0 — pul birinchi kuni olingan, tushum hisobotiga qo'shilmaydi
    yangi = Patient(
        first_name=asl.first_name,
        last_name=asl.last_name,
        birth_date=asl.birth_date,
        phone=asl.phone,
        address=asl.address,
        service_id=g["service_id"],
        provider_id=asl.provider_id,
        referrer_id=None,          # komissiya birinchi to'lovda berilgan
        payment_amount=0,
        payment_type="prepaid",
        cash_amount=0, card_amount=0, click_amount=0, qr_amount=0,
        ticket_number=ticket,
        queue_status="kutmoqda",
        cabinet=svc.cabinet if svc else None,
        created_by=user.id,
        prepaid_from_id=nishon.id,
    )
    db.add(yangi)
    nishon.used_count = int(nishon.used_count if nishon.used_count is not None else 1) + 1
    qolgan = g["remaining"] - 1

    ip, ua = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="COURSE_VISIT",
        table_name="patient_services", record_id=nishon.id,
        new_data={"patient": g["patient_name"], "service": g["service_name"],
                  "used": g["used_count"] + 1, "of": g["quantity"]},
        ip_address=ip, device_info=ua,
    )
    db.commit()
    db.refresh(yangi)

    return {
        "message": f"{asl.first_name} navbatga qo'yildi ({ticket}). Qolgan kun: {qolgan}",
        "ticket_number": ticket,
        "patient_id": yangi.id,
        "remaining": qolgan,
    }


@router.post("/undo")
def undo_session(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    """Adashib bosilgan "Keldi" ni qaytaradi: bugungi tashrif bekor qilinadi."""
    kalit = (body or {}).get("key")
    if not kalit:
        raise HTTPException(status_code=400, detail="Kurs ko'rsatilmagan")

    g = _kursni_top(db, kalit)
    idlar = [ps.id for ps in g["_rows"]]
    bugun_boshi = datetime.combine(date.today(), datetime.min.time())

    tashrif = (
        db.query(Patient)
        .filter(
            Patient.prepaid_from_id.in_(idlar),
            Patient.created_at >= bugun_boshi,
            Patient.is_cancelled == False,  # noqa: E712
        )
        .order_by(Patient.created_at.desc())
        .first()
    )
    if not tashrif:
        raise HTTPException(status_code=400, detail="Bugun bu kurs bo'yicha tashrif yo'q")

    ps = db.query(PatientService).filter(PatientService.id == tashrif.prepaid_from_id).first()
    if ps:
        ps.used_count = max(1, int(ps.used_count or 1) - 1)

    tashrif.is_cancelled = True
    tashrif.cancelled_at = datetime.now()
    tashrif.cancelled_by = user.id
    tashrif.cancel_reason = "Kurs tashrifi bekor qilindi"

    ip, ua = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="COURSE_VISIT_UNDO",
        table_name="patient_services", record_id=ps.id if ps else 0,
        new_data={"ticket": tashrif.ticket_number, "patient": g["patient_name"]},
        ip_address=ip, device_info=ua,
    )
    db.commit()
    return {"message": "Tashrif bekor qilindi", "remaining": g["remaining"] + 1}
