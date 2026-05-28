from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth_utils import require_ceo
from database import get_db
from models.advance import Advance
from models.balance import Balance, BalanceHistory
from models.expense import Expense
from models.patient import Patient
from models.transaction import Transaction
from models.user import User
from services.reports_data import _period_range

router = APIRouter(prefix="/api/cash", tags=["cash"])


@router.get("")
def cash_register(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    today = date.today()
    start_d = from_date or today
    end_d = to_date or today
    s, e = _period_range(start_d, end_d)

    bal = db.query(Balance).first()
    current = bal.current_balance if bal else 0

    # Opening = current minus net change in period (approximation for demo)
    txs = db.query(Transaction).filter(
        Transaction.created_at >= s, Transaction.created_at <= e,
        Transaction.is_cancelled == False,
    ).all()
    patients = db.query(Patient).filter(
        Patient.created_at >= s, Patient.created_at <= e,
        Patient.is_cancelled == False,
    ).all()

    cash_in = sum(t.total_amount for t in txs if t.payment_type == "cash")
    card_in = sum(t.total_amount for t in txs if t.payment_type == "card")
    total_in = cash_in + card_in

    expenses = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(Expense.created_at >= s, Expense.created_at <= e, Expense.is_cancelled == False)
        .scalar()
    )
    advances = (
        db.query(func.coalesce(func.sum(Advance.amount), 0))
        .filter(Advance.created_at >= s, Advance.created_at <= e, Advance.is_cancelled == False)
        .scalar()
    )
    salaries = (
        db.query(func.coalesce(func.sum(BalanceHistory.amount), 0))
        .filter(
            BalanceHistory.created_at >= s,
            BalanceHistory.created_at <= e,
            BalanceHistory.entry_type == "salary",
        )
        .scalar()
    )

    total_out = int(expenses or 0) + int(advances or 0) + abs(int(salaries or 0))
    opening = max(0, current - total_in + total_out)

    return {
        "period_start": start_d.isoformat(),
        "period_end": end_d.isoformat(),
        "opening_balance": opening,
        "cash_income": int(cash_in),
        "card_income": int(card_in),
        "total_income": int(total_in),
        "expenses": int(expenses or 0),
        "advances": int(advances or 0),
        "salaries": abs(int(salaries or 0)),
        "total_out": total_out,
        "closing_balance": current,
        "patients_count": len(patients),
        "transactions": [
            {
                "id": t.id,
                "amount": t.total_amount,
                "payment_type": t.payment_type,
                "created_at": t.created_at.isoformat(),
            }
            for t in txs[:50]
        ],
    }
