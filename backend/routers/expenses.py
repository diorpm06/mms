from datetime import date, datetime

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


def sync_advances_and_salaries_to_expenses(db: Session):
    from datetime import timedelta
    from models.advance import Advance
    from models.provider_advance import ProviderAdvance
    from models.salary_log import SalaryLog
    from models.employee import Employee
    from models.provider import Provider

    changed = False
    advances = db.query(Advance).filter(Advance.is_cancelled == False).all()
    for a in advances:
        emp = db.query(Employee).filter(Employee.id == a.employee_id).first()
        emp_name = emp.full_name if emp else f"Xodim #{a.employee_id}"
        desc_text = f"Avans: {emp_name}" + (f" — {a.note}" if a.note else "")
        exists = db.query(Expense).filter(
            Expense.category == "Avans",
            Expense.amount == a.amount,
            Expense.created_at >= a.created_at - timedelta(seconds=10),
            Expense.created_at <= a.created_at + timedelta(seconds=10),
        ).first()
        if not exists:
            db.add(Expense(
                description=f"[MANBA: Naqt kassa] {desc_text}",
                amount=a.amount,
                category="Avans",
                created_at=a.created_at,
                created_by=a.created_by or 1,
            ))
            changed = True

    prov_advances = db.query(ProviderAdvance).all()
    for pa in prov_advances:
        p_name = "Noma'lum"
        if pa.recipient_type == "provider":
            p = db.query(Provider).filter(Provider.id == pa.recipient_id).first()
            if p: p_name = p.full_name
        desc_text = f"Avans: {p_name}" + (f" — {pa.note}" if pa.note else "")
        exists = db.query(Expense).filter(
            Expense.category == "Avans",
            Expense.amount == pa.amount,
            Expense.created_at >= pa.created_at - timedelta(seconds=10),
            Expense.created_at <= pa.created_at + timedelta(seconds=10),
        ).first()
        if not exists:
            db.add(Expense(
                description=f"[MANBA: Naqt kassa] {desc_text}",
                amount=pa.amount,
                category="Avans",
                created_at=pa.created_at,
                created_by=1,
            ))
            changed = True

    salaries = db.query(SalaryLog).all()
    for s in salaries:
        emp = db.query(Employee).filter(Employee.id == s.employee_id).first()
        emp_name = emp.full_name if emp else f"Xodim #{s.employee_id}"
        exists = db.query(Expense).filter(
            Expense.category == "Oylik",
            Expense.amount == s.amount,
            Expense.created_at >= s.paid_at - timedelta(seconds=10),
            Expense.created_at <= s.paid_at + timedelta(seconds=10),
        ).first()
        if not exists:
            db.add(Expense(
                description=f"[MANBA: Naqt kassa] Oylik: {emp_name}",
                amount=s.amount,
                category="Oylik",
                created_at=s.paid_at,
                created_by=1,
            ))
            changed = True

    if changed:
        db.commit()


@router.get("", response_model=list[ExpenseOut])
def list_expenses(
    month: int | None = None,
    year: int | None = None,
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    try:
        sync_advances_and_salaries_to_expenses(db)
    except Exception as err:
        print("Expense sync error:", err)

    q = db.query(Expense).filter(Expense.is_cancelled == False)
    if from_date and to_date:
        q = q.filter(
            Expense.created_at >= datetime.combine(from_date, datetime.min.time()),
            Expense.created_at <= datetime.combine(to_date, datetime.max.time()),
        )
    elif year and month:
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
    _: User = Depends(require_admin_or_ceo),
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
    bal.updated_at = datetime.now()
    log_balance_change(db, e.amount, "expense_cancel", f"Harajat bekor: {e.description}")
    e.is_cancelled = True
    e.cancelled_at = datetime.now()
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
