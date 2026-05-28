from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_utils import require_admin_or_ceo, require_ceo
from database import get_db
from models.provider import Provider
from models.user import User
from schemas import ProviderCreate, ProviderOut, ProviderUpdate
from services.finance import payout_recipient_balance

router = APIRouter(prefix="/api/providers", tags=["providers"])


class PayoutBody(BaseModel):
    source: str | None = None


@router.get("", response_model=list[ProviderOut])
def list_providers(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    q = db.query(Provider)
    if active_only:
        q = q.filter(Provider.is_active == True)
    return q.order_by(Provider.full_name).all()


@router.post("", response_model=ProviderOut)
def create_provider(data: ProviderCreate, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    p = Provider(**data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/{provider_id}", response_model=ProviderOut)
def update_provider(
    provider_id: int, data: ProviderUpdate, db: Session = Depends(get_db), _: User = Depends(require_ceo)
):
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider topilmadi")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{provider_id}")
def delete_provider(provider_id: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider topilmadi")
    p.is_active = False
    db.commit()
    return {"message": "O'chirildi"}


@router.post("/{provider_id}/payout")
def payout_provider(
    provider_id: int,
    body: PayoutBody,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    payout = payout_recipient_balance(db, "provider", provider_id, source=body.source)
    db.commit()
    return {"message": "Balans chiqarildi", "amount": payout.amount, "source": body.source}
