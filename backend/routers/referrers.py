from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_utils import require_admin_or_ceo, require_ceo
from database import get_db
from models.referrer import Referrer
from models.user import User
from schemas import ReferrerCreate, ReferrerOut, ReferrerUpdate
from services.finance import payout_recipient_balance

router = APIRouter(prefix="/api/referrers", tags=["referrers"])


class PayoutBody(BaseModel):
    source: str | None = None


def _sodda_ism(nom: str | None) -> str:
    """Ismni taqqoslash uchun soddalashtiradi: katta-kichik harf va ortiqcha
    bo'shliqlar hisobga olinmaydi. "Qazbek travmatolog" va "Qazbek Travmatolog"
    bir xil deb qaraladi."""
    return " ".join((nom or "").split()).casefold()


def _bir_xil_ismli(db: Session, nom: str, bundan_tashqari: int | None = None):
    """Shu ismdagi faol yo'naltiruvchini qaytaradi (bo'lmasa None)."""
    kalit = _sodda_ism(nom)
    if not kalit:
        return None
    for r in db.query(Referrer).filter(Referrer.is_active == True).all():  # noqa: E712
        if r.id != bundan_tashqari and _sodda_ism(r.full_name) == kalit:
            return r
    return None


@router.get("", response_model=list[ReferrerOut])
def list_referrers(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    q = db.query(Referrer)
    if active_only:
        q = q.filter(Referrer.is_active == True)
    referrers = q.order_by(Referrer.full_name).all()

    # "Bugun" va "Jami ishlagan" ustunlari uchun (balansdan alohida)
    from services.earnings_daily import referrers_summary
    xulosa = referrers_summary(db, referrers)

    res = []
    for r in referrers:
        item = ReferrerOut.model_validate(r)
        x = xulosa.get(r.id) or {}
        item.today_earned = x.get("today", 0)
        item.total_earned = x.get("total_earned", 0)
        res.append(item)
    return res


@router.get("/{referrer_id}/earnings-daily")
def referrer_earnings_daily(
    referrer_id: int,
    limit: int = 60,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """Yo'naltiruvchining ishlagan puli kunma-kun."""
    from services.earnings_daily import referrer_daily
    natija = referrer_daily(db, referrer_id, limit)
    if not natija:
        raise HTTPException(status_code=404, detail="Yo'naltiruvchi topilmadi")
    return natija


@router.get("/{referrer_id}/earnings-daily/{kun}")
def referrer_earnings_day(
    referrer_id: int,
    kun: date,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """Bir kundagi bemorlar ro'yxati."""
    from services.earnings_daily import referrer_day_patients
    return referrer_day_patients(db, referrer_id, kun)


@router.get("/pending", response_model=list[ReferrerOut])
def pending_referrers(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    return db.query(Referrer).filter(Referrer.is_active == True, Referrer.is_confirmed == False).all()


@router.post("", response_model=ReferrerOut)
def create_referrer(data: ReferrerCreate, db: Session = Depends(get_db), user: User = Depends(require_admin_or_ceo)):
    d = data.model_dump()
    majburiy = bool(d.pop("force", False))

    # Ilgari hech qanday tekshiruv yo'q edi: bemor qabul qilayotgan xodim
    # ro'yxatdan yo'naltiruvchini topa olmay yangisini qo'shardi va bitta
    # odam ikki qatorga bo'linib ketardi — ishlagan puli ham, hisoboti ham.
    if not majburiy:
        mavjud = _bir_xil_ismli(db, d.get("full_name"))
        if mavjud:
            raise HTTPException(
                status_code=409,
                detail=f"\"{mavjud.full_name}\" nomli yo'naltiruvchi allaqachon bor. "
                       "Ro'yxatdan o'shani tanlang. Bu boshqa odam bo'lsa, "
                       "ismini aniqroq yozing (masalan familiyasi bilan).",
            )

    d["full_name"] = " ".join((d.get("full_name") or "").split())

    # If created by CEO directly in CEO page, consider it confirmed unless specified
    if user.role == "ceo" and "is_confirmed" not in d:
        d["is_confirmed"] = True
    else:
        d["is_confirmed"] = False
    r = Referrer(**d)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.post("/{referrer_id}/confirm", response_model=ReferrerOut)
def confirm_referrer(
    referrer_id: int, data: ReferrerUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)
):
    r = db.query(Referrer).filter(Referrer.id == referrer_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Yo'naltiruvchi topilmadi")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    r.is_confirmed = True
    db.commit()
    db.refresh(r)
    return r


@router.put("/{referrer_id}", response_model=ReferrerOut)
def update_referrer(
    referrer_id: int, data: ReferrerUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin_or_ceo)
):
    r = db.query(Referrer).filter(Referrer.id == referrer_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Yo'naltiruvchi topilmadi")

    yangilanish = data.model_dump(exclude_unset=True)

    # Tahrirlashda ham boshqasining ismiga aylantirib yuborilmasin. Ism
    # o'zgarmayotgan bo'lsa tekshirilmaydi — aks holda "baribir qo'shish" bilan
    # kiritilgan yozuvning stavkasini ham tahrirlab bo'lmay qolardi.
    if yangilanish.get("full_name") and _sodda_ism(yangilanish["full_name"]) != _sodda_ism(r.full_name):
        mavjud = _bir_xil_ismli(db, yangilanish["full_name"], bundan_tashqari=r.id)
        if mavjud:
            raise HTTPException(
                status_code=409,
                detail=f"\"{mavjud.full_name}\" nomli boshqa yo'naltiruvchi allaqachon bor. "
                       "Ismini boshqacharoq yozing.",
            )
        yangilanish["full_name"] = " ".join(yangilanish["full_name"].split())

    for k, v in yangilanish.items():
        setattr(r, k, v)
    # If CEO edits rates, confirm automatically
    if user.role == "ceo" and data.is_confirmed is not False:
        r.is_confirmed = True
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{referrer_id}")
def delete_referrer(referrer_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    r = db.query(Referrer).filter(Referrer.id == referrer_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Yo'naltiruvchi topilmadi")
    r.is_active = False
    db.commit()
    return {"message": "O'chirildi"}


@router.post("/{referrer_id}/payout")
def payout_referrer(
    referrer_id: int,
    body: PayoutBody,
    db: Session = Depends(get_db),
    # Faqat rahbar: bu klinikadan pul chiqishi. Admin panelida bunday tugma
    # yo'q edi, lekin API ochiq turgani uchun so'rov yuborib chiqarish mumkin edi.
    _: User = Depends(require_ceo),
):
    payout = payout_recipient_balance(db, "referrer", referrer_id, source=body.source)
    qoplandi = getattr(payout, "settled_from_advance", 0) or 0
    db.commit()
    msg = "Balans chiqarildi"
    if qoplandi:
        msg = (f"{qoplandi:,} so'm avans qarzidan qoplandi"
               + (f", qo'lga {payout.amount:,} so'm berildi" if payout.amount else ", qo'lga pul berilmadi"))
    return {
        "message": msg,
        "amount": payout.amount,
        "settled_from_advance": qoplandi,
        "source": body.source,
    }
