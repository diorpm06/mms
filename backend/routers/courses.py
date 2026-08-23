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
from pydantic import BaseModel, Field

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


def _kunlarni_oqi(matn: str | None) -> list[int]:
    """ "1,3,5" -> [1, 3, 5].  Bo'sh bo'lsa [] (ya'ni har kuni)."""
    if not matn:
        return []
    kunlar = []
    for bolak in str(matn).split(","):
        bolak = bolak.strip()
        if bolak.isdigit():
            n = int(bolak)
            if 0 < n <= 365 and n not in kunlar:
                kunlar.append(n)
    return sorted(kunlar)


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
                "days": [],          # jadval: qaysi kunlarda beriladi
                "_oldindan": False,
            }
            g["services"][ps.service_id] = x

        for kun in _kunlarni_oqi(ps.course_days):
            if kun not in x["days"]:
                x["days"].append(kun)

        # STRICT RULE: A service is ONLY a multi-day treatment course if is_course is explicitly True.
        # A quantity of 5 or 10 today in a single visit with is_course=False must NEVER be split into 5 days!
        soni = int(ps.quantity or 1)
        is_c = getattr(ps, "is_course", False)
        if is_c is True:
            x["_oldindan"] = True
        x["quantity"] += soni
        x["total_price"] += int(ps.total_price or 0)

        if p.ticket_number and p.ticket_number not in g["tickets"]:
            g["tickets"].append(p.ticket_number)
        g["_rows"].append(ps)

    # "Keldi" tashriflari. Kurs kuni SANALAR bo'yicha hisoblanadi: bemor
    # bir kelganda bir necha xizmat olsa ham, bu bitta kun.
    barcha_id = [ps.id for g in guruh.values() for ps in g["_rows"]]
    tashrif_sanalari: dict[int, set] = {}   # patient_service_id -> {sana}
    if barcha_id:
        for ps_id, sana in (
            db.query(Patient.prepaid_from_id, func.date(Patient.created_at))
            .filter(
                Patient.prepaid_from_id.in_(barcha_id),
                Patient.is_cancelled == False,  # noqa: E712
            )
            .distinct()
            .all()
        ):
            tashrif_sanalari.setdefault(ps_id, set()).add(str(sana))

    natija = []
    for g in guruh.values():
        # Kursning nechanchi kunidamiz: bemor necha KUN kelgan
        kurs_sanalari = set()
        for ps in g["_rows"]:
            kurs_sanalari |= tashrif_sanalari.get(ps.id, set())

        # Xizmat bo'yicha qo'lda kiritilgan (tahrirlangan) qiymat
        qolda: dict[int, int] = {}
        for ps in g["_rows"]:
            qolda[ps.service_id] = qolda.get(ps.service_id, 0) + int(ps.used_count or 0)

        # Eski yozuvlarda "keldi" tashrifi qoldirilmasdan, faqat used_count
        # qo'lda kiritilgan bo'lishi mumkin. Bunday holda ham kun o'tgan
        # deb sanaladi, aks holda xizmat "tugagan" ko'rinib, kurs esa
        # "hali boshlanmagan" bo'lib qolardi.
        #
        # DIQQAT: bu yerda QO'SHILMAYDI, eng KATTASI olinadi. Bir kunda
        # 2 ta xizmat berilgani baribir 1 kun.
        qolda_kun = 0
        for sid, x in g["services"].items():
            n = qolda.get(sid, 0)
            if n <= 0:
                continue
            jadval = sorted(x["days"])
            if jadval:
                # "1,3,5" jadvalida 2 ta seans berilgan bo'lsa -> 3-kun o'tgan
                qolda_kun = max(qolda_kun, jadval[min(n, len(jadval)) - 1])
            else:
                qolda_kun = max(qolda_kun, n)

        otgan_kun = max(len(kurs_sanalari), qolda_kun)
        g["otgan_kun"] = otgan_kun
        g["keyingi_kun"] = otgan_kun + 1

        xizmatlar = []
        for sid, x in g["services"].items():
            jadval = sorted(x["days"])
            if jadval:
                # Jadvalli xizmat: o'tgan kunlar ichida nechtasi shu
                # xizmatga to'g'ri kelgan
                ishlatilgan = sum(1 for k in jadval if k <= otgan_kun)
            else:
                # Jadvalsiz (eski tartib): har tashrifda beriladi
                ishlatilgan = min(otgan_kun, x["quantity"])
            ishlatilgan = max(ishlatilgan, qolda.get(sid, 0))
            qolgan = max(0, x["quantity"] - ishlatilgan)
            xizmatlar.append({
                **x, "days": jadval,
                "used_count": ishlatilgan, "remaining": qolgan,
            })

        # KUN SONI — xizmatlar bo'yicha QO'SHILMAYDI.
        #
        # Bemor bir kelganda o'ziga tegishli hamma muolajani oladi. Ya'ni
        # bir kunda 2 ta xizmat bo'lsa, bu 2 kun emas, 1 kun.
        #
        # Kurs uzunligi:
        #   jadvalli xizmat  -> eng katta kun raqami   (masalan 1,3,5 -> 5)
        #   jadvalsiz xizmat -> kunlar soni            (masalan 4 kun -> 4)
        # Ikkalasidan eng kattasi kursning uzunligi bo'ladi.
        #
        # Masalan: Massaj 4 kun + Elektroforez 2 kun = 4 kunlik kurs.
        #   1-kun: ikkalasi,  2-kun: ikkalasi,  3-4-kun: faqat massaj.
        uzunlik = max(
            (max(x["days"]) if x["days"] else x["quantity"]) for x in xizmatlar
        ) if xizmatlar else 0
        g["uzunlik"] = uzunlik
        jami_qolgan = max(0, uzunlik - otgan_kun)

        # Kurs deb faqat OLDINDAN to'langani hisoblanadi: bitta yozuvda
        # "soni" birdan katta kiritilgan bo'lishi shart.
        #
        # Bemor bir kunda bir xizmatdan ikki marta foydalanib, har safar
        # alohida to'lasa — bu ikkita kunlik to'lov, kurs emas. Ilgari
        # 1 + 1 qo'shilib "2 kunlik kurs" bo'lib chiqardi.
        kursli = [x for x in xizmatlar if x["_oldindan"]]
        if faqat_tugallanmagan:
            if not kursli:
                continue
            if all(x["remaining"] <= 0 for x in kursli):
                continue
            xizmatlar = kursli
            uzunlik = max(
                (max(x["days"]) if x["days"] else x["quantity"]) for x in kursli
            )
            g["uzunlik"] = uzunlik
            jami_qolgan = max(0, uzunlik - otgan_kun)

        g["services"] = sorted(xizmatlar, key=lambda x: x["service_name"] or "")
        g["total_remaining"] = jami_qolgan
        natija.append(g)

    natija.sort(key=lambda x: x["started_at"] or "", reverse=True)
    return natija


def _tozala(g: dict) -> dict:
    """Ichki (_ bilan boshlanadigan) maydonlarni javobdan olib tashlaydi."""
    toza = {k: v for k, v in g.items() if not k.startswith("_")}
    toza["otgan_kun"] = g.get("otgan_kun", 0)
    toza["uzunlik"] = g.get("uzunlik", 0)
    toza["services"] = [
        {k: v for k, v in x.items() if not k.startswith("_")}
        for x in g.get("services", [])
    ]
    return toza


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

    # Faqat OLDINDAN to'langan xizmatlar. Bemorning o'sha kuni alohida
    # to'lab olgan bir martalik xizmatlari bu yerga tushmasligi kerak —
    # ular uchun bepul tashrif ochilib qolmasin.
    kursli = [x for x in g["services"] if x["_oldindan"]]
    if not kursli or all(x["remaining"] <= 0 for x in kursli):
        raise HTTPException(status_code=400,
                            detail="Bu kurs tugagan — qolgan kun yo'q")

    # Bugun kursning nechanchi kuni
    bugungi_kun = g["keyingi_kun"]

    # JADVAL: xizmatda kunlar ro'yxati bo'lsa, faqat bugungi kunga
    # belgilangani beriladi. Jadvalsiz xizmat esa (eski tartib) kuni
    # qolguncha har tashrifda beriladi.
    qoldi_bor = [
        x for x in kursli
        if x["remaining"] > 0 and (bugungi_kun in x["days"] if x["days"] else True)
    ]
    if not qoldi_bor:
        raise HTTPException(
            status_code=400,
            detail="Kursning %d-kuniga birorta muolaja belgilanmagan. "
                   "Jadvalni tekshiring." % bugungi_kun)

    # Bitta tashrif = bitta kun, nechta xizmat olinishidan qat'i nazar.
    qolgan_keyin = max(0, g["uzunlik"] - bugungi_kun)

    from routers.patients import _keyingi_raqam, get_queue_prefix_letter

    kun_oxiri = datetime.combine(date.today(), datetime.max.time())
    yaratilgan = []

    # RO'YXATGA OLINGAN KUNMI? Bemor bugun to'lab yozilgan bo'lsa, u
    # allaqachon bugungi ro'yxatda va TV ekranida turibdi. "Keldi" bosilganda
    # yana bitta 0 so'mlik qator ochilsa, ismi ikki marta chiqadi va kunlik
    # hisobotdagi bemor soni oshib ketadi. Shuning uchun o'sha kuni yangi
    # qator ochilmaydi — mavjud qatorning o'zi ishlatiladi, faqat kun sanaladi.
    bugun = date.today()
    royxat_kuni = asl.created_at.date() if asl.created_at else None
    royxat_kunimi = royxat_kuni == bugun

    # Bir kunda ikki marta bosilishidan himoya. Keyingi kunlarda buni
    # yuqoridagi "bor" tekshiruvi ushlaydi (0 so'mlik qator bo'yicha), lekin
    # ro'yxatga olingan kuni bunday qator yaratilmaydi. O'sha kuni faqat
    # 1-kun berilishi mumkin, ya'ni kun raqami 1 dan boshqa bo'lsa —
    # "Keldi" allaqachon bosilgan.
    if royxat_kunimi and bugungi_kun != 1:
        raise HTTPException(
            status_code=400,
            detail="Bu bemor bugun allaqachon qabul qilingan. "
                   "Bir kunda bir marta bosiladi.",
        )

    for x in qoldi_bor:
        svc = db.query(Service).filter(Service.id == x["service_id"]).first()
        # Tashrifni shu xizmatning to'lov yozuviga bog'laymiz
        nishon = max(
            [ps for ps in g["_rows"] if ps.service_id == x["service_id"]],
            key=lambda ps: int(ps.quantity or 1),
        )

        if royxat_kunimi:
            mavjud = db.query(Patient).filter(
                Patient.id == nishon.patient_id).first()
            if mavjud is not None and not mavjud.is_cancelled:
                nishon.used_count = int(nishon.used_count or 0) + 1
                yaratilgan.append((
                    mavjud, x,
                    mavjud.ticket_number or "A-%03d" % mavjud.id))
                continue

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
                   f"{bugungi_kun}-kun / {g['uzunlik']} kun. "
                   f"Qolgan kun: {qolgan_keyin}",
        "day": bugungi_kun,
        "course_length": g["uzunlik"],
        "ticket_number": talonlar[0],
        "tickets": talonlar,
        "remaining": qolgan_keyin,
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
            # Chekda: bu kursning nechanchi kuni va jami necha kun
            "prepaid_day": bugungi_kun,
            "prepaid_total": g["uzunlik"],
            "prepaid_lines": [
                {
                    "service_name": x["service_name"],
                    "day": bugungi_kun,
                    "total": g["uzunlik"],
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

    # Ro'yxatga olingan kuni alohida 0 so'mlik qator ochilmaydi (ismi ikki
    # marta chiqmasligi uchun) — o'sha kuni bekor qiladigan tashrif ham yo'q,
    # faqat sanalgan kunni qaytarish kerak.
    if not tashriflar:
        asl = db.query(Patient).filter(Patient.id == g["patient_id"]).first()
        bugun_yozilgan = (
            asl is not None and asl.created_at is not None
            and asl.created_at.date() == date.today()
        )
        sanalgan = [ps for ps in g["_rows"] if int(ps.used_count or 0) > 0]
        if not bugun_yozilgan or not sanalgan:
            raise HTTPException(status_code=400,
                                detail="Bugun bu kurs bo'yicha tashrif yo'q")
        for ps in sanalgan:
            ps.used_count = max(0, int(ps.used_count or 0) - 1)
        ip, ua = get_client_info(request)
        log_audit(
            db, user_id=user.id, user_role=user.role,
            action_type="COURSE_VISIT_UNDO",
            table_name="patient_services", record_id=g["_rows"][0].id,
            new_data={"patient": g["patient_name"],
                      "izoh": "ro'yxatga olingan kun qaytarildi"},
            ip_address=ip, device_info=ua,
        )
        db.commit()
        kurs_qolgan = max(
            (x["remaining"] for x in g["services"] if x["_oldindan"]),
            default=0)
        return {
            "message": "%d ta tashrif bekor qilindi" % len(sanalgan),
            "remaining": kurs_qolgan + 1,
        }

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
    # Bitta tashrif = bitta kun (nechta xizmat bo'lishidan qat'i nazar)
    kurs_qolgan = max((x["remaining"] for x in g["services"] if x["_oldindan"]),
                      default=0)
    return {
        "message": "%d ta tashrif bekor qilindi" % len(tashriflar),
        "remaining": kurs_qolgan + 1,
    }


class EditCourseItemSchema(BaseModel):
    service_id: int
    quantity: int
    used_count: int


class EditCourseRequest(BaseModel):
    key: str
    items: list[EditCourseItemSchema]


@router.put("/edit")
def edit_course(
    body: EditCourseRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    """Davolanish kursi kunlari va bajarilgan kunlar sonini tahrirlaydi."""
    g = _kursni_top(db, body.key)
    rows_by_sid = {ps.service_id: ps for ps in g["_rows"]}

    for item in body.items:
        ps = rows_by_sid.get(item.service_id)
        if ps:
            ps.quantity = max(1, item.quantity)
            ps.used_count = max(0, min(ps.quantity, item.used_count))
            ps.is_course = True
            if ps.unit_price:
                ps.total_price = ps.unit_price * ps.quantity

    ip, ua = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="COURSE_EDIT",
        table_name="patient_services", record_id=g["_rows"][0].id,
        new_data={"patient": g["patient_name"], "key": body.key},
        ip_address=ip, device_info=ua,
    )
    db.commit()
    return {"message": "Davolanish kursi kunlari muvaffaqiyatli tahrirlandi ✓"}
