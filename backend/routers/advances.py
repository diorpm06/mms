import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_utils import require_admin_or_ceo, require_ceo
from database import get_db
from models.expense import Expense
from models.provider import Provider
from models.provider_advance import ProviderAdvance
from models.referrer import Referrer
from models.user import User
from schemas import ProviderAdvanceCreate, ProviderAdvanceOut

router = APIRouter(prefix="/api/advances", tags=["advances"])
logger = logging.getLogger(__name__)


def _row(a: ProviderAdvance, name: str) -> ProviderAdvanceOut:
    return ProviderAdvanceOut(
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


@router.get("", response_model=List[ProviderAdvanceOut])
def list_advances(
    recipient_type: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    query = db.query(ProviderAdvance).filter(ProviderAdvance.is_cancelled == False)  # noqa: E712
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
        results.append(_row(a, name))
    return results


@router.post("", response_model=ProviderAdvanceOut)
def create_advance(
    data: ProviderAdvanceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
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
    from services.finance import process_advance, sync_provider_balance, sync_referrer_balance
    desc = f"Avans: {name}" + (f" — {data.note}" if data.note else "")
    process_advance(db, data.amount, desc)

    # Balans shu zahoti yangi avansni hisobga olishi uchun — aks holda
    # ro'yxatlarda eski (avansdan oldingi) balans ko'rinib qolardi.
    if data.recipient_type == "provider":
        sync_provider_balance(db, data.recipient_id)
    else:
        sync_referrer_balance(db, data.recipient_id)

    # Harajatlar ro'yxatida ham ko'rinishi uchun Expense jadvaliga qo'shamiz.
    # expense_id orqali avansga bog'lanadi — bekor qilinganda ikkalasi
    # birga (lekin kassaga faqat BIR marta tegib) bekor qilinadi.
    exp = Expense(
        description=f"[MANBA: Naqt kassa] {desc}",
        amount=data.amount,
        created_by=user.id,
        category="Avans",
    )
    db.add(exp)
    db.flush()
    advance.expense_id = exp.id

    db.commit()
    db.refresh(advance)

    try:
        from services.sheets import add_payout_to_sheets
        add_payout_to_sheets({
            "created_at": advance.created_at,
            "recipient_name": name,
            "recipient_type": data.recipient_type,
            "amount": data.amount,
            "source": "Avans",
        })
    except Exception as err:
        logger.warning(f"Sheets ga yuborilmadi (avans): {err}")

    return _row(advance, name)


@router.post("/{advance_id}/settle")
def settle_advance(
    advance_id: int,
    amount: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    advance = db.query(ProviderAdvance).filter(
        ProviderAdvance.id == advance_id, ProviderAdvance.is_cancelled == False,  # noqa: E712
    ).first()
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


class CancelBody(BaseModel):
    reason: Optional[str] = None


@router.post("/{advance_id}/cancel")
def cancel_advance_endpoint(
    advance_id: int,
    body: CancelBody | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    """Adashib yoki noto'g'ri berilgan avansni bekor qiladi. Kassadan
    yechilgan pul qaytariladi, hali qoplanmagan qismi (remaining) hisobga
    olinadi — agar allaqachon qisman qoplangan bo'lsa, faqat qolgan qismi
    qaytariladi."""
    advance = db.query(ProviderAdvance).filter(
        ProviderAdvance.id == advance_id, ProviderAdvance.is_cancelled == False,  # noqa: E712
    ).first()
    if not advance:
        raise HTTPException(status_code=404, detail="Avans topilmadi")
    if advance.is_settled:
        raise HTTPException(status_code=400, detail="To'liq qoplangan avansni bekor qilib bo'lmaydi")

    from services.finance import cancel_advance as cancel_advance_kassa
    cancel_advance_kassa(db, advance.remaining)

    advance.is_cancelled = True
    advance.cancelled_at = datetime.now()
    advance.cancelled_by = user.id
    advance.cancel_reason = (body.reason if body else None) or "Bekor qilindi"
    advance.remaining = 0

    if advance.expense_id:
        exp = db.query(Expense).filter(Expense.id == advance.expense_id).first()
        if exp and not exp.is_cancelled:
            # Kassa allaqachon yuqorida qaytarildi — bu yerda faqat
            # Harajatlar ro'yxatidan chiqarish uchun belgilanadi, yana
            # bir marta kassaga tegilmaydi.
            exp.is_cancelled = True
            exp.cancelled_at = datetime.now()
            exp.cancelled_by = user.id
            exp.cancel_reason = advance.cancel_reason

    from services.finance import sync_provider_balance, sync_referrer_balance
    if advance.recipient_type == "provider":
        sync_provider_balance(db, advance.recipient_id)
    else:
        sync_referrer_balance(db, advance.recipient_id)

    db.commit()
    return {"message": "Avans bekor qilindi, kassaga qaytarildi"}


class ProviderAdvanceUpdate(BaseModel):
    amount: Optional[int] = None
    note: Optional[str] = None


@router.put("/{advance_id}", response_model=ProviderAdvanceOut)
def update_advance(
    advance_id: int,
    data: ProviderAdvanceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    advance = db.query(ProviderAdvance).filter(
        ProviderAdvance.id == advance_id, ProviderAdvance.is_cancelled == False
    ).first()
    if not advance:
        raise HTTPException(status_code=404, detail="Avans topilmadi")

    if data.amount is not None and data.amount != advance.amount:
        diff = data.amount - advance.amount
        from services.finance import get_or_create_balance, log_balance_change
        bal = get_or_create_balance(db)
        bal.current_balance -= diff
        bal.updated_at = datetime.now()
        log_balance_change(
            db,
            -diff,
            "advance_edit",
            f"Avans tahrirlandi (#{advance.id}): {advance.amount:,} so'm -> {data.amount:,} so'm",
        )
        advance.amount = data.amount
        advance.remaining = max(0, advance.remaining + diff)

    if data.note is not None:
        advance.note = data.note

    if advance.expense_id:
        exp = db.query(Expense).filter(Expense.id == advance.expense_id).first()
        if exp and not exp.is_cancelled:
            exp.amount = advance.amount
            name = "Noma'lum"
            if advance.recipient_type == "provider":
                p = db.query(Provider).filter(Provider.id == advance.recipient_id).first()
                if p: name = p.full_name
            elif advance.recipient_type == "referrer":
                r = db.query(Referrer).filter(Referrer.id == advance.recipient_id).first()
                if r: name = r.full_name
            desc_text = f"Avans: {name}" + (f" — {advance.note}" if advance.note else "")
            exp.description = f"[MANBA: Naqt kassa] {desc_text}"

    db.commit()
    db.refresh(advance)

    name = "Noma'lum"
    if advance.recipient_type == "provider":
        p = db.query(Provider).filter(Provider.id == advance.recipient_id).first()
        if p: name = p.full_name
    elif advance.recipient_type == "referrer":
        r = db.query(Referrer).filter(Referrer.id == advance.recipient_id).first()
        if r: name = r.full_name

    return _row(advance, name)

