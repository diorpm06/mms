from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_utils import hash_password, require_admin_or_ceo, require_ceo, require_doctor_or_admin_or_ceo
from database import get_db
from models.provider import Provider, ProviderService
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
    _: User = Depends(require_doctor_or_admin_or_ceo),
):
    q = db.query(Provider)
    if active_only:
        q = q.filter(Provider.is_active == True)
    providers = q.order_by(Provider.full_name).all()

    provider_ids = [p.id for p in providers]
    user_map = {}
    if provider_ids:
        users = db.query(User).filter(User.provider_id.in_(provider_ids), User.is_active == True).all()
        for u in users:
            user_map[u.provider_id] = u.username

    res = []
    for p in providers:
        item = ProviderOut.model_validate(p)
        item.username = user_map.get(p.id)
        item.service_ids = [s.id for s in p.services] if p.services else []
        res.append(item)

    return res


@router.post("", response_model=ProviderOut)
def create_provider(data: ProviderCreate, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    if data.username:
        exists = db.query(User).filter(User.username == data.username).first()
        if exists:
            raise HTTPException(status_code=400, detail=f"'{data.username}' nomli login allaqachon band")
        if not data.password:
            raise HTTPException(status_code=400, detail="Login kiritilganda parol ham kiritilishi kerak")

    service_ids = data.service_ids or []
    provider_data = data.model_dump(exclude={"username", "password", "service_ids"})
    p = Provider(**provider_data)
    db.add(p)
    db.commit()
    db.refresh(p)

    if service_ids:
        for sid in service_ids:
            db.add(ProviderService(provider_id=p.id, service_id=sid))
        db.commit()

    if data.username and data.password:
        u = User(
            full_name=p.full_name,
            role="doctor",
            username=data.username,
            hashed_password=hash_password(data.password),
            provider_id=p.id,
            is_active=True,
        )
        db.add(u)
        db.commit()

    res = ProviderOut.model_validate(p)
    res.username = data.username
    res.service_ids = service_ids
    return res


@router.put("/{provider_id}", response_model=ProviderOut)
def update_provider(
    provider_id: int, data: ProviderUpdate, db: Session = Depends(get_db), _: User = Depends(require_ceo)
):
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider topilmadi")

    update_dict = data.model_dump(exclude_unset=True)
    username = update_dict.pop("username", None)
    password = update_dict.pop("password", None)
    service_ids = update_dict.pop("service_ids", None)

    for k, v in update_dict.items():
        setattr(p, k, v)
    db.commit()

    if service_ids is not None:
        db.query(ProviderService).filter(ProviderService.provider_id == p.id).delete()
        for sid in service_ids:
            db.add(ProviderService(provider_id=p.id, service_id=sid))
        db.commit()

    db.refresh(p)

    linked_user = db.query(User).filter(User.provider_id == p.id, User.is_active == True).first()
    if username:
        if linked_user:
            if username != linked_user.username:
                exists = db.query(User).filter(User.username == username, User.id != linked_user.id).first()
                if exists:
                    raise HTTPException(status_code=400, detail=f"'{username}' login allaqachon band")
                linked_user.username = username
            linked_user.full_name = p.full_name
            if password:
                linked_user.hashed_password = hash_password(password)
        else:
            if not password:
                raise HTTPException(status_code=400, detail="Yangi akkaunt uchun parol kiritishingiz shart")
            linked_user = User(
                full_name=p.full_name,
                role="doctor",
                username=username,
                hashed_password=hash_password(password),
                provider_id=p.id,
                is_active=True,
            )
            db.add(linked_user)
        db.commit()

    res = ProviderOut.model_validate(p)
    res.username = linked_user.username if linked_user else None
    res.service_ids = [s.id for s in p.services] if p.services else []
    return res


@router.delete("/{provider_id}")
def delete_provider(
    provider_id: int,
    hard: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo)
):
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider topilmadi")

    users = db.query(User).filter(User.provider_id == provider_id).all()

    if hard:
        for u in users:
            db.delete(u)
        db.delete(p)
    else:
        p.is_active = not p.is_active
        for u in users:
            u.is_active = p.is_active

    db.commit()
    return {"message": "Status o'zgartirildi / O'chirildi", "is_active": p.is_active if not hard else False}



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
