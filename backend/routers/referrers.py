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


@router.get("", response_model=list[ReferrerOut])
def list_referrers(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    q = db.query(Referrer)
    if active_only:
        q = q.filter(Referrer.is_active == True)
    return q.order_by(Referrer.full_name).all()


@router.get("/pending", response_model=list[ReferrerOut])
def pending_referrers(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    return db.query(Referrer).filter(Referrer.is_active == True, Referrer.is_confirmed == False).all()


@router.post("", response_model=ReferrerOut)
def create_referrer(data: ReferrerCreate, db: Session = Depends(get_db), user: User = Depends(require_admin_or_ceo)):
    d = data.model_dump()
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
    for k, v in data.model_dump(exclude_unset=True).items():
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
