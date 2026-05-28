from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel as _BaseModel, Field
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from auth_utils import require_admin_or_ceo, require_ceo
from database import get_db
from models.expense import Expense
from models.user import User
from schemas import ExpenseCreate, ExpenseOut
from services.finance import process_expense
from services.telegram_notify import send_telegram_message

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


def _split_source(description: str) -> tuple[str | None, str]:
    if description.startswith("[MANBA:") and "] " in description:
        prefix, rest = description.split("] ", 1)
        source = prefix.replace("[MANBA:", "").strip()
        return source, rest
    return None, description


def _expense_out(e: Expense) -> dict:
    source, desc = _split_source(e.description)
    return {
        "id": e.id,
        "description": desc,
        "amount": e.amount,
        "created_by": e.created_by,
        "created_at": e.created_at,
        "category": e.category,
        "source": source,
    }


@router.get("", response_model=list[ExpenseOut])
def list_expenses(
    month: int | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    q = db.query(Expense).filter(Expense.is_cancelled == False)
    if year and month:
        q = q.filter(
            extract("year", Expense.created_at) == year,
            extract("month", Expense.created_at) == month,
        )
    items = q.order_by(Expense.created_at.desc()).all()
    return [_expense_out(e) for e in items]


@router.get("/summary")
def expenses_summary(
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    q = db.query(func.coalesce(func.sum(Expense.amount), 0))
    if year and month:
        q = q.filter(
            extract("year", Expense.created_at) == year,
            extract("month", Expense.created_at) == month,
        )
    total = q.scalar()
    return {"total": int(total or 0)}


@router.post("", response_model=ExpenseOut)
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    full_description = data.description
    if data.source:
        full_description = f"[MANBA: {data.source}] {data.description}"
    process_expense(db, data.amount, full_description)
    expense = Expense(description=full_description, amount=data.amount, created_by=user.id, category=data.category)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    import asyncio
    import threading
    threading.Thread(
        target=lambda: asyncio.run(
            send_telegram_message(
                f"💸 Harajat: {data.amount:,} so'm\n📁 {data.category or 'Boshqa'}\n🧾 {data.description}".replace(",", " "),
                section="finance",
            )
        ),
        daemon=True,
    ).start()
    return _expense_out(expense)


class CancelBody(_BaseModel):
    reason: str = Field(min_length=3)


@router.post("/{expense_id}/cancel")
def cancel_expense(
    expense_id: int,
    body: CancelBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_ceo),
):
    e = db.query(Expense).filter(Expense.id == expense_id, Expense.is_cancelled == False).first()
    if not e:
        raise HTTPException(status_code=404, detail="Harajat topilmadi yoki bekor qilingan")
    from services.finance import get_or_create_balance, log_balance_change
    bal = get_or_create_balance(db)
    bal.current_balance += e.amount
    bal.updated_at = datetime.utcnow()
    log_balance_change(db, e.amount, "expense_cancel", f"Harajat bekor: {e.description}")
    e.is_cancelled = True
    e.cancelled_at = datetime.utcnow()
    e.cancelled_by = user.id
    e.cancel_reason = body.reason
    db.commit()
    import asyncio
    import threading
    threading.Thread(
        target=lambda: asyncio.run(
            send_telegram_message(
                f"❌ Harajat bekor qilindi\n🧾 {e.description}\n📝 Sabab: {body.reason}",
                section="cancellations",
            )
        ),
        daemon=True,
    ).start()
    return {"message": "Harajat bekor qilindi"}
