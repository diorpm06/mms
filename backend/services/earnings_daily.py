"""Shifokor va yo'naltiruvchining ishlagan puli — kunma-kun.

Balans bitta yig'ma raqam: u qaysi kundan qancha yig'ilganini ko'rsatmaydi.
Bu yerda o'sha yig'indi tranzaksiyalardan kunlarga bo'lib chiqariladi, ya'ni
"jami shuncha" degan raqamning har bir so'mi qaysi kunda, nechta bemordan
kelganini ko'rsatish mumkin bo'ladi.

Manba — `transactions` jadvali. Balans esa alohida saqlanadigan yig'ma
raqam, shuning uchun ikkalasi farq qilishi mumkin (masalan balans qo'lda
chiqarilgan bo'lsa yoki hisobdan chiqib ketgan bo'lsa). Javobda ikkalasi
ham qaytariladi — farqi ko'rinib tursin.
"""
from datetime import date

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from models.patient import Patient
from models.payout import Payout
from models.provider import Provider
from models.referrer import Referrer
from models.transaction import Transaction


def _kunlik(db: Session, ustun, filtr, chegara: int | None):
    """Kun bo'yicha yig'indi: sana, bemor soni, summa."""
    kun = func.date(Transaction.created_at).label("kun")
    q = (
        db.query(
            kun,
            func.count(func.distinct(Transaction.patient_id)).label("soni"),
            func.coalesce(func.sum(ustun), 0).label("summa"),
        )
        .filter(filtr, Transaction.is_cancelled == False)  # noqa: E712
        .group_by(kun)
        .order_by(kun.desc())
    )
    if chegara:
        q = q.limit(chegara)
    return [
        {
            "date": str(r.kun),
            "patients": int(r.soni or 0),
            "amount": int(r.summa or 0),
        }
        for r in q.all()
        if int(r.summa or 0) != 0
    ]


def _kunning_bemorlari(db: Session, ustun, filtr, kun: date):
    """Bir kundagi bemorlar ro'yxati — jami qanday yig'ilganini ko'rsatish uchun."""
    qatorlar = (
        db.query(Transaction, Patient)
        .join(Patient, Patient.id == Transaction.patient_id)
        .filter(
            filtr,
            Transaction.is_cancelled == False,  # noqa: E712
            func.date(Transaction.created_at) == kun,
        )
        .order_by(Transaction.created_at)
        .all()
    )
    natija = []
    for t, p in qatorlar:
        summa = int(getattr(t, ustun.key) or 0)
        if summa == 0:
            continue
        natija.append({
            "patient_name": f"{p.first_name} {p.last_name}".strip(),
            "ticket_number": p.ticket_number,
            "time": t.created_at.strftime("%H:%M") if t.created_at else None,
            "total_amount": int(t.total_amount or 0),
            "amount": summa,
        })
    return natija


def _xulosa(db: Session, ustun, filtr, balans: int, kim: str, kim_id: int,
            kunlar: list[dict], tolov_turi: tuple[str, ...]):
    bugun = date.today().isoformat()
    bugungi = next((k["amount"] for k in kunlar if k["date"] == bugun), 0)
    jami = int(
        db.query(func.coalesce(func.sum(ustun), 0))
        .filter(filtr, Transaction.is_cancelled == False)  # noqa: E712
        .scalar() or 0
    )
    chiqarilgan = int(
        db.query(func.coalesce(func.sum(Payout.amount), 0))
        .filter(Payout.recipient_type.in_(tolov_turi),
                Payout.recipient_id == kim_id)
        .scalar() or 0
    )
    return {
        "id": kim_id,
        "name": kim,
        "today": bugungi,
        "total_earned": jami,
        "paid_out": chiqarilgan,
        "balance": int(balans or 0),
        # Balans yig'ma raqam; ishlagan puli minus chiqarilgani bilan
        # mos kelmasa, bu yerda ko'rinadi.
        "expected_balance": max(0, jami - chiqarilgan),
        "days": kunlar,
    }


def provider_daily(db: Session, provider_id: int, limit: int | None = 60) -> dict:
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        return {}
    filtr = Transaction.provider_id == provider_id
    kunlar = _kunlik(db, Transaction.provider_amount, filtr, limit)
    return _xulosa(db, Transaction.provider_amount, filtr, p.balance,
                   p.full_name, provider_id, kunlar, ("provider", "employee"))


def referrer_daily(db: Session, referrer_id: int, limit: int | None = 60) -> dict:
    r = db.query(Referrer).filter(Referrer.id == referrer_id).first()
    if not r:
        return {}
    filtr = Transaction.referrer_id == referrer_id
    kunlar = _kunlik(db, Transaction.referrer_amount, filtr, limit)
    return _xulosa(db, Transaction.referrer_amount, filtr, r.balance,
                   r.full_name, referrer_id, kunlar, ("referrer",))


def provider_day_patients(db: Session, provider_id: int, kun: date) -> list[dict]:
    return _kunning_bemorlari(
        db, Transaction.provider_amount, Transaction.provider_id == provider_id, kun)


def referrer_day_patients(db: Session, referrer_id: int, kun: date) -> list[dict]:
    return _kunning_bemorlari(
        db, Transaction.referrer_amount, Transaction.referrer_id == referrer_id, kun)


def _hammasi(db: Session, ustun, id_ustun, obyektlar, tolov_turi) -> dict[int, dict]:
    """Ro'yxat uchun: har bir kishining BUGUNGI va JAMI summasi, bitta so'rovda."""
    bugun = date.today()
    idlar = [o.id for o in obyektlar]
    if not idlar:
        return {}
    # Bugungi va jami — BITTA so'rovda. Masofaviy bazada har bir alohida
    # so'rov qimmatga tushadi, shuning uchun ikkalasi birga olinadi.
    qatorlar = (
        db.query(
            id_ustun,
            func.coalesce(func.sum(ustun), 0).label("jami"),
            func.coalesce(func.sum(case(
                (func.date(Transaction.created_at) == bugun, ustun), else_=0
            )), 0).label("bugungi"),
        )
        .filter(id_ustun.in_(idlar), Transaction.is_cancelled == False)  # noqa: E712
        .group_by(id_ustun)
        .all()
    )
    topilgan = {r[0]: (int(r.bugungi or 0), int(r.jami or 0)) for r in qatorlar}
    return {
        o.id: {"today": topilgan.get(o.id, (0, 0))[0],
               "total_earned": topilgan.get(o.id, (0, 0))[1]}
        for o in obyektlar
    }


def providers_summary(db: Session, providers) -> dict[int, dict]:
    return _hammasi(db, Transaction.provider_amount, Transaction.provider_id,
                    providers, ("provider", "employee"))


def referrers_summary(db: Session, referrers) -> dict[int, dict]:
    return _hammasi(db, Transaction.referrer_amount, Transaction.referrer_id,
                    referrers, ("referrer",))
