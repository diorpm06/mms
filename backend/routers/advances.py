from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth_utils import require_admin_or_ceo, require_ceo
from database import get_db
from models.provider import Provider
from models.provider_advance import ProviderAdvance
from models.referrer import Referrer
from models.user import User
from schemas import ProviderAdvanceCreate, ProviderAdvanceOut

router = APIRouter(prefix="/api/advances", tags=["advances"])


@router.get("", response_model=List[ProviderAdvanceOut])
def list_advances(
    recipient_type: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    query = db.query(ProviderAdvance)
    if recipient_type:
        query = query.filter(ProviderAdvance.recipient_type == recipient_type)

    advances = query.order_by(ProviderAdvance.created_at.desc()).all()
    results = []
    for a in advances:
        name = "Noma'lum"
        if a.recipient_type == "provider":
            p = db.query(Provider).filter(Provider.id == a.recipient_id).first()
            if p:
                name = p.full_name
        elif a.recipient_type == "referrer":
            r = db.query(Referrer).filter(Referrer.id == a.recipient_id).first()
            if r:
                name = r.full_name

        results.append(
            ProviderAdvanceOut(
                id=a.id,
                recipient_type=a.recipient_type,
                recipient_id=a.recipient_id,
                recipient_name=name,
                amount=a.amount,
                remaining=a.remaining,
                note=a.note,
                is_settled=a.is_settled,
                created_at=a.created_at,
            )
        )
    return results


@router.post("", response_model=ProviderAdvanceOut)
def create_advance(
    data: ProviderAdvanceCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    if data.recipient_type not in ("provider", "referrer"):
        raise HTTPException(status_code=400, detail="Recipient type 'provider' yoki 'referrer' bo'lishi kerak")

    name = "Noma'lum"
    if data.recipient_type == "provider":
        p = db.query(Provider).filter(Provider.id == data.recipient_id).first()
        if not p:
            raise HTTPException(status_code=404, detail="Shifokor topilmadi")
        name = p.full_name
    else:
        r = db.query(Referrer).filter(Referrer.id == data.recipient_id).first()
        if not r:
            raise HTTPException(status_code=404, detail="Yo'naltiruvchi topilmadi")
        name = r.full_name

    advance = ProviderAdvance(
        recipient_type=data.recipient_type,
        recipient_id=data.recipient_id,
        amount=data.amount,
        remaining=data.amount,  # initial remaining = total amount
        note=data.note,
        is_settled=False,
    )
    db.add(advance)
    db.commit()
    db.refresh(advance)

    return ProviderAdvanceOut(
        id=advance.id,
        recipient_type=advance.recipient_type,
        recipient_id=advance.recipient_id,
        recipient_name=name,
        amount=advance.amount,
        remaining=advance.remaining,
        note=advance.note,
        is_settled=advance.is_settled,
        created_at=advance.created_at,
    )


@router.post("/{advance_id}/settle")
def settle_advance(
    advance_id: int,
    amount: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    advance = db.query(ProviderAdvance).filter(ProviderAdvance.id == advance_id).first()
    if not advance:
        raise HTTPException(status_code=404, detail="Avans topilmadi")

    if advance.is_settled:
        raise HTTPException(status_code=400, detail="Ushbu avans allaqachon to'liq qoplangan")

    deduct = min(amount, advance.remaining)
    advance.remaining -= deduct

    if advance.remaining <= 0:
        advance.remaining = 0
        advance.is_settled = True
        advance.settled_at = datetime.now()

    db.commit()
    return {"message": f"{deduct:,} so'm avans qoplandi", "remaining": advance.remaining, "is_settled": advance.is_settled}
