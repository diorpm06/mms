"""Statsionar xizmat ko'rsatuvchiga kunlik haq yozish.

Vercel'da doimiy ishlab turadigan jadval (cron) yo'q, shu sababli hisoblash
"so'ralganda" bajariladi: statsionar ro'yxati yoki shifokorlar hisoboti
o'qilganda yetishmayotgan kunlar to'ldiriladi. Har bir bemor-kun juftligi
uchun bazada aynan bitta qator bo'lgani uchun (uq_inp_accrual_day) necha marta
chaqirilsa ham summa ikkilanmaydi.
"""

from datetime import date

from sqlalchemy.orm import Session

from models.inpatient import Inpatient
from models.inpatient_accrual import InpatientProviderAccrual
from models.provider import Provider

STANDART_KUNLIK = 50_000


def _kunlik_stavka(provider: Provider) -> int:
    qiymat = getattr(provider, "inpatient_daily_rate", None)
    return int(qiymat) if qiymat is not None else STANDART_KUNLIK


def _hisob_oralig(inp: Inpatient, bugun: date) -> tuple[date, date] | None:
    """Haq yoziladigan birinchi va oxirgi kun. Yotgan kun ham hisoblanadi."""
    boshi = inp.admitted_at.date()
    oxiri = inp.discharged_at.date() if inp.discharged_at else bugun
    if oxiri > bugun:
        oxiri = bugun
    if boshi > oxiri:
        return None
    return boshi, oxiri


def sync_inpatient_accruals(db: Session, inpatient_id: int | None = None) -> int:
    """Shifokor haqini yozadi. Yozilgan qatorlar sonini qaytaradi.

    DIQQAT — 2026-08-21 dan boshlab bu funksiya FAQAT bemor CHIQARILGANDA
    chaqiriladi. Ilgari u ro'yxat yoki hisobot ochilganda ham ishlardi va
    yotgan bemorning har kuni uchun shifokor balansiga pul qo'shib borardi
    — bemor hali bir tiyin to'lamagan bo'lsa ham. Natijada to'lanmagan pul
    shifokor hisobida turardi.

    Chiqarishda barcha yotgan kunlar bir yo'la yoziladi (chiqish kuni ham
    to'liq kun hisoblanadi).

    inpatient_id berilsa faqat o'sha bemor hisoblanadi.
    """
    bugun = date.today()

    q = db.query(Inpatient).filter(
        Inpatient.is_cancelled == False,  # noqa: E712
        Inpatient.doctor_id.isnot(None),
    )
    if inpatient_id is not None:
        q = q.filter(Inpatient.id == inpatient_id)
    else:
        q = q.filter(Inpatient.status == "yotmoqda")

    bemorlar = q.all()
    if not bemorlar:
        return 0

    doctor_ids = {b.doctor_id for b in bemorlar}
    shifokorlar = {
        p.id: p
        for p in db.query(Provider).filter(Provider.id.in_(doctor_ids)).all()
        if getattr(p, "is_inpatient_provider", False)
    }
    if not shifokorlar:
        return 0

    yozildi = 0
    for inp in bemorlar:
        provider = shifokorlar.get(inp.doctor_id)
        if not provider:
            continue
        oralig = _hisob_oralig(inp, bugun)
        if not oralig:
            continue
        boshi, oxiri = oralig

        bor = {
            r[0]
            for r in db.query(InpatientProviderAccrual.accrual_date)
            .filter(InpatientProviderAccrual.inpatient_id == inp.id)
            .all()
        }

        stavka = _kunlik_stavka(provider)
        kun = boshi
        while kun <= oxiri:
            if kun not in bor:
                db.add(InpatientProviderAccrual(
                    inpatient_id=inp.id,
                    provider_id=provider.id,
                    accrual_date=kun,
                    amount=stavka,
                ))
                provider.balance = int(provider.balance or 0) + stavka
                yozildi += 1
            kun = date.fromordinal(kun.toordinal() + 1)

    if yozildi:
        try:
            db.commit()
        except Exception:
            # Ikki so'rov bir vaqtda kelib bir xil kunni yozmoqchi bo'lsa
            # unique cheklovi ishlaydi — bu xato emas, keyingi safar to'g'rilanadi.
            db.rollback()
            return 0
    return yozildi


def reverse_inpatient_accruals(db: Session, inpatient_id: int) -> int:
    """Bemor bekor qilinganda yozilgan haqlarni shifokor balansidan qaytaradi."""
    qatorlar = (
        db.query(InpatientProviderAccrual)
        .filter(InpatientProviderAccrual.inpatient_id == inpatient_id)
        .all()
    )
    if not qatorlar:
        return 0

    jami: dict[int, int] = {}
    for r in qatorlar:
        jami[r.provider_id] = jami.get(r.provider_id, 0) + int(r.amount or 0)

    for pid, summa in jami.items():
        p = db.query(Provider).filter(Provider.id == pid).first()
        if p:
            p.balance = int(p.balance or 0) - summa

    for r in qatorlar:
        db.delete(r)

    return sum(jami.values())


def provider_inpatient_summary(db: Session) -> list[dict]:
    """Har bir statsionar xizmat ko'rsatuvchi bo'yicha yig'ma hisobot.

    Hisobot faqat O'QIYDI. Ilgari shu yerda sync_inpatient_accruals
    chaqirilardi va hisobotni ochishning o'zi shifokor balansini
    oshirib yuborardi.
    """

    shifokorlar = (
        db.query(Provider)
        .filter(Provider.is_inpatient_provider == True)  # noqa: E712
        .order_by(Provider.full_name)
        .all()
    )
    if not shifokorlar:
        return []

    ids = [p.id for p in shifokorlar]
    qatorlar = (
        db.query(InpatientProviderAccrual)
        .filter(InpatientProviderAccrual.provider_id.in_(ids))
        .all()
    )

    bugun = date.today()
    oy_boshi = bugun.replace(day=1)

    yigma: dict[int, dict] = {
        p.id: {"jami": 0, "kunlar": 0, "bu_oy": 0, "bugun": 0} for p in shifokorlar
    }
    for r in qatorlar:
        y = yigma.get(r.provider_id)
        if y is None:
            continue
        summa = int(r.amount or 0)
        y["jami"] += summa
        y["kunlar"] += 1
        if r.accrual_date >= oy_boshi:
            y["bu_oy"] += summa
        if r.accrual_date == bugun:
            y["bugun"] += summa

    yotganlar = (
        db.query(Inpatient)
        .filter(
            Inpatient.is_cancelled == False,  # noqa: E712
            Inpatient.status == "yotmoqda",
            Inpatient.doctor_id.in_(ids),
        )
        .all()
    )
    hozirgi: dict[int, int] = {}
    for inp in yotganlar:
        hozirgi[inp.doctor_id] = hozirgi.get(inp.doctor_id, 0) + 1

    natija = []
    for p in shifokorlar:
        y = yigma[p.id]
        natija.append({
            "id": p.id,
            "full_name": p.full_name,
            "specialization": p.specialization,
            "phone": p.phone,
            "is_active": p.is_active,
            "daily_rate": _kunlik_stavka(p),
            "balance": int(p.balance or 0),
            "current_patients": hozirgi.get(p.id, 0),
            "total_days": y["kunlar"],
            "total_accrued": y["jami"],
            "month_accrued": y["bu_oy"],
            "today_accrued": y["bugun"],
        })
    return natija


def provider_accrual_detail(db: Session, provider_id: int, limit: int = 200) -> list[dict]:
    """Bitta shifokorning kunma-kun haqlari (eng yangisi birinchi).

    Faqat O'QIYDI — ro'yxatni ochish balansga ta'sir qilmaydi.
    """

    qatorlar = (
        db.query(InpatientProviderAccrual, Inpatient)
        .join(Inpatient, Inpatient.id == InpatientProviderAccrual.inpatient_id)
        .filter(InpatientProviderAccrual.provider_id == provider_id)
        .order_by(InpatientProviderAccrual.accrual_date.desc(),
                  InpatientProviderAccrual.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "date": r.accrual_date.isoformat(),
            "amount": int(r.amount or 0),
            "inpatient_id": r.inpatient_id,
            "patient_name": f"{inp.first_name} {inp.last_name}".strip(),
            "room_number": inp.room_number,
            "status": inp.status,
        }
        for r, inp in qatorlar
    ]
