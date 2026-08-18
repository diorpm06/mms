"""Oldindan to'langan ko'p kunlik xizmatlar (kurslar).

Bemor bir necha kunlik xizmatni oldindan to'laydi (masalan 4 ta elektroforez).
Har kelganida "Keldi" bosiladi: qayta pul olinmaydi, navbat raqami beriladi
va qolgan kun kamayadi.

Uch muhim qoida:

1. Kurs ODAM + TO'LOV KUNI bo'yicha yig'iladi. Xodim 4 kunni bir yozuvda (4)
   ham, ikki yozuvda (1 + 3) ham kiritishi mumkin — agar ikkalasi BIR KUNDA
   kiritilgan bo'lsa, bu bitta kurs.

   Turli kunlardagi to'lovlar qo'shilmaydi: bemor bugun kelib to'lasa,
   ertaga yana kelib to'lasa — bular ikkita alohida tashrif, kurs emas.

2. Bir odamning bir kunda to'lagan HAMMA xizmati bitta qatorda ko'rsatiladi
   (massaj ham, fizioterapiya ham). "Keldi" bosilganda hammasi birdan
   belgilanadi — bemor bir marta kelib ikkala muolajani oladi.

3. Ishlatilgan kun faqat "Keldi" bosilganda sanaladi. Ro'yxatga olishning
   o'zi kunni yemaydi — birinchi kun uchun ham "Keldi" bosiladi va shunda
   navbat taloni chop etiladi.
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
    """Bir odamni tanish uchun kalit (hisobotlardagi bilan bir xil qoida)."""
    tel = (p.phone or "").strip()
    if tel and tel != "+998":
        return "tel:" + tel
    return "ism:%s|%s|%s" % (
        (p.first_name or "").strip().lower(),
        (p.last_name or "").strip().lower(),
        p.birth_date,
    )


def _kurslarni_yig(db: Session, faqat_tugallanmagan: bool = True,
                   kalit_filtr: str | None = None) -> list[dict]:
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

    # (odam, to'lov kuni) -> kurs;  ichida xizmatlar
    guruh: dict[tuple, dict] = {}
    for ps, p in qatorlar:
        kun = p.created_at.date() if p.created_at else date.today()
        kalit = "%s::%s" % (_odam_kaliti(p), kun.isoformat())
        if kalit_filtr and kalit != kalit_filtr:
            continue
        g = guruh.get(kalit)
        if g is None:
            g = {
                "key": kalit,
                "patient_id": p.id,
                "patient_name": f"{p.first_name} {p.last_name}".strip(),
                "phone": p.phone,
                "provider_id": p.provider_id,
                "started_at": p.created_at.isoformat() if p.created_at else None,
                "tickets": [],
                "services": {},
                "_rows": [],
            }
            guruh[kalit] = g

        x = g["services"].get(ps.service_id)
        if x is None:
            x = {
                "service_id": ps.service_id,
                "service_name": ps.service.name if ps.service else None,
                "category": ps.service.category if ps.service else None,
                "quantity": 0,
                "total_price": 0,
            }
            g["services"][ps.service_id] = x
        x["quantity"] += int(ps.quantity or 1)
        x["total_price"] += int(ps.total_price or 0)

        if p.ticket_number and p.ticket_number not in g["tickets"]:
            g["tickets"].append(p.ticket_number)
        g["_rows"].append(ps)

    # Ishlatilgan kunlar: faqat "Keldi" tashriflari sanaladi
    barcha_id = [ps.id for g in guruh.values() for ps in g["_rows"]]
    tashriflar: dict[int, int] = {}
    if barcha_id:
        for ps_id, soni in (
            db.query(Patient.prepaid_from_id, func.count(Patient.id))
            .filter(
                Patient.prepaid_from_id.in_(barcha_id),
                Patient.is_cancelled == False,  # noqa: E712
            )
            .group_by(Patient.prepaid_from_id)
            .all()
        ):
            tashriflar[ps_id] = int(soni)

    natija = []
    for g in guruh.values():
        # xizmat bo'yicha ishlatilgan kunlar
        xizmat_ishlatilgan: dict[int, int] = {}
        for ps in g["_rows"]:
            xizmat_ishlatilgan[ps.service_id] = (
                xizmat_ishlatilgan.get(ps.service_id, 0) + tashriflar.get(ps.id, 0)
            )

        xizmatlar = []
        jami_qolgan = 0
        for sid, x in g["services"].items():
            ishlatilgan = xizmat_ishlatilgan.get(sid, 0)
            qolgan = max(0, x["quantity"] - ishlatilgan)
            jami_qolgan += qolgan
            xizmatlar.append({**x, "used_count": ishlatilgan, "remaining": qolgan})

        # Kurs deb faqat bir kundan ko'p to'langan xizmatlar hisoblanadi
        kursli = [x for x in xizmatlar if x["quantity"] > 1]
        if faqat_tugallanmagan:
            if not kursli:
                continue
            if all(x["remaining"] <= 0 for x in kursli):
                continue
            xizmatlar = kursli
            jami_qolgan = sum(x["remaining"] for x in kursli)

        g["services"] = sorted(xizmatlar, key=lambda x: x["service_name"] or "")
        g["total_remaining"] = jami_qolgan
        natija.append(g)

    natija.sort(key=lambda x: x["started_at"] or "", reverse=True)
    return natija


def _tozala(g: dict) -> dict:
    return {k: v for k, v in g.items() if not k.startswith("_")}


def _kursni_top(db: Session, kalit: str) -> dict:
    if not kalit:
        raise HTTPException(status_code=400, detail="Kurs ko'rsatilmagan")
    uchun = _kurslarni_yig(db, faqat_tugallanmagan=False, kalit_filtr=kalit)
    if not uchun:
        raise HTTPException(status_code=404, detail="Kurs topilmadi")
    return uchun[0]


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
    """Bemor keldi: qayta to'lov OLINMAYDI, navbatga qo'yiladi.

    Bemorning shu kursdagi BARCHA xizmatlari birdan belgilanadi — u bir marta
    kelib hammasini oladi. Har bir xizmat o'z bo'limining navbat raqamini oladi.
    """
    g = _kursni_top(db, (body or {}).get("key"))

    asl = db.query(Patient).filter(Patient.id == g["patient_id"]).first()
    if not asl:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")

    idlar = [ps.id for ps in g["_rows"]]

    # To'lov qatorlarini QULFLAYMIZ. "Keldi" ikki qurilmadan bir vaqtda
    # bosilsa, ikkala so'rov ham "bugun kelmagan" degan xulosaga kelib,
    # bemorga ikkita navbat berilishi mumkin edi.
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        (db.query(PatientService)
           .filter(PatientService.id.in_(idlar))
           .with_for_update()
           .all())

    bugun_boshi = datetime.combine(date.today(), datetime.min.time())
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
            detail=f"Bu bemor bugun allaqachon qabul qilingan ({bor.ticket_number}). "
                   "Bir kunda bir marta bosiladi.",
        )

    qoldi_bor = [x for x in g["services"] if x["remaining"] > 0]
    if not qoldi_bor:
        raise HTTPException(status_code=400,
                            detail="Bu kurs tugagan — qolgan kun yo'q")

    from routers.patients import _keyingi_raqam, get_queue_prefix_letter

    kun_oxiri = datetime.combine(date.today(), datetime.max.time())
    yaratilgan = []

    for x in qoldi_bor:
        svc = db.query(Service).filter(Service.id == x["service_id"]).first()
        # Tashrifni shu xizmatning to'lov yozuviga bog'laymiz
        nishon = max(
            [ps for ps in g["_rows"] if ps.service_id == x["service_id"]],
            key=lambda ps: int(ps.quantity or 1),
        )
        prefiks = get_queue_prefix_letter(svc)
        ticket = _keyingi_raqam(db, prefiks, bugun_boshi, kun_oxiri)

        yangi = Patient(
            first_name=asl.first_name,
            last_name=asl.last_name,
            birth_date=asl.birth_date,
            phone=asl.phone,
            address=asl.address,
            service_id=x["service_id"],
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
        db.flush()
        nishon.used_count = int(nishon.used_count or 0) + 1
        yaratilgan.append((yangi, x, ticket))

    ip, ua = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="COURSE_VISIT",
        table_name="patient_services", record_id=g["_rows"][0].id,
        new_data={
            "patient": g["patient_name"],
            "xizmatlar": [x["service_name"] for x in qoldi_bor],
            "talonlar": [t for _, _, t in yaratilgan],
        },
        ip_address=ip, device_info=ua,
    )
    db.commit()

    talonlar = [t for _, _, t in yaratilgan]
    birinchi = yaratilgan[0][0]

    return {
        "message": f"{asl.first_name} navbatga qo'yildi ({', '.join(talonlar)}). "
                   f"Qolgan kun: {g['total_remaining'] - len(qoldi_bor)}",
        "ticket_number": talonlar[0],
        "tickets": talonlar,
        "remaining": g["total_remaining"] - len(qoldi_bor),
        # Navbat talonini darrov chop etish uchun
        "patient": {
            "id": birinchi.id,
            "first_name": asl.first_name,
            "last_name": asl.last_name,
            "phone": asl.phone,
            "birth_date": asl.birth_date.isoformat() if asl.birth_date else None,
            "ticket_number": ", ".join(talonlar),
            "cabinet": birinchi.cabinet,
            "queue_status": "kutmoqda",
            "payment_amount": 0,
            "payment_type": "prepaid",
            "cash_amount": 0, "card_amount": 0, "click_amount": 0, "qr_amount": 0,
            "discount_amount": 0,
            "created_at": birinchi.created_at.isoformat() if birinchi.created_at else None,
            "service_name": qoldi_bor[0]["service_name"],
            "service_category": qoldi_bor[0]["category"],
            "is_prepaid_visit": True,
            "prepaid_lines": [
                {
                    "service_name": x["service_name"],
                    "day": x["used_count"] + 1,
                    "total": x["quantity"],
                }
                for x in qoldi_bor
            ],
            "services": [
                {
                    "service_name": x["service_name"],
                    "category": x["category"],
                    "quantity": 1,
                    "total_price": 0,
                }
                for x in qoldi_bor
            ],
        },
    }


@router.post("/undo")
def undo_session(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    """Adashib bosilgan "Keldi" ni qaytaradi: bugungi tashriflar bekor qilinadi."""
    g = _kursni_top(db, (body or {}).get("key"))
    idlar = [ps.id for ps in g["_rows"]]
    bugun_boshi = datetime.combine(date.today(), datetime.min.time())

    tashriflar = (
        db.query(Patient)
        .filter(
            Patient.prepaid_from_id.in_(idlar),
            Patient.created_at >= bugun_boshi,
            Patient.is_cancelled == False,  # noqa: E712
        )
        .all()
    )
    if not tashriflar:
        raise HTTPException(status_code=400, detail="Bugun bu kurs bo'yicha tashrif yo'q")

    for t in tashriflar:
        ps = db.query(PatientService).filter(PatientService.id == t.prepaid_from_id).first()
        if ps:
            ps.used_count = max(0, int(ps.used_count or 0) - 1)
        t.is_cancelled = True
        t.cancelled_at = datetime.now()
        t.cancelled_by = user.id
        t.cancel_reason = "Kurs tashrifi bekor qilindi"

    ip, ua = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="COURSE_VISIT_UNDO",
        table_name="patient_services", record_id=g["_rows"][0].id,
        new_data={"patient": g["patient_name"],
                  "talonlar": [t.ticket_number for t in tashriflar]},
        ip_address=ip, device_info=ua,
    )
    db.commit()
    return {
        "message": "%d ta tashrif bekor qilindi" % len(tashriflar),
        "remaining": g["total_remaining"] + len(tashriflar),
    }
