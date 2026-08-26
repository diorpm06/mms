from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.patient import Patient
from models.expense import Expense
from models.user import User
from auth_utils import require_admin_or_ceo, get_current_user

router = APIRouter(prefix="/api/incassation", tags=["incassation"])


class ShiftClosureBody(BaseModel):
    actual_cash: int = Field(ge=0)
    incassation_amount: int = Field(ge=0)
    notes: Optional[str] = None


@router.get("/current-shift")
def get_current_shift_status(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    from services.reports_data import get_active_shift_start
    start_dt = get_active_shift_start(db)
    end_dt = datetime.combine(today, datetime.max.time())

    from sqlalchemy import case

    # Total cash payments collected today
    cash_payments = (
        db.query(
            func.coalesce(
                func.sum(
                    case(
                        (Patient.cash_amount > 0, Patient.cash_amount),
                        else_=case(
                            (Patient.payment_type.in_(["cash", "naqd"]), Patient.payment_amount),
                            else_=0
                        )
                    )
                ),
                0
            )
        )
        .filter(
            Patient.created_at >= start_dt,
            Patient.created_at <= end_dt,
            Patient.is_cancelled == False,
        )
        .scalar()
    )

    # Total card payments collected today
    card_payments = (
        db.query(
            func.coalesce(
                func.sum(
                    case(
                        (Patient.card_amount > 0, Patient.card_amount),
                        else_=case(
                            (Patient.payment_type.in_(["card", "karta"]), Patient.payment_amount),
                            else_=0
                        )
                    )
                ),
                0
            )
        )
        .filter(
            Patient.created_at >= start_dt,
            Patient.created_at <= end_dt,
            Patient.is_cancelled == False,
        )
        .scalar()
    )

    # Cash expenses today
    today_expenses = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.created_at >= start_dt,
            Expense.created_at <= end_dt,
            Expense.is_cancelled == False,
        )
        .scalar()
    )

    expected_cash = max(0, int(cash_payments or 0) - int(today_expenses or 0))

    return {
        "date": today.isoformat(),
        "cashier_name": user.full_name,
        "cash_payments": int(cash_payments or 0),
        "card_payments": int(card_payments or 0),
        "today_expenses": int(today_expenses or 0),
        "expected_cash_in_drawer": expected_cash,
    }


@router.post("/close-shift")
def close_shift_and_incassate(
    body: ShiftClosureBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    shift_info = get_current_shift_status(db, user)
    expected = shift_info["expected_cash_in_drawer"]
    actual = body.actual_cash
    variance = actual - expected

    from sqlalchemy import text
    query = text("""
        INSERT INTO shift_incassations (cashier_id, expected_cash, actual_cash, incassation_amount, variance, notes, created_at)
        VALUES (:cid, :exp, :act, :inc, :var, :notes, :created)
    """)
    db.execute(query, {
        "cid": user.id,
        "exp": expected,
        "act": actual,
        "inc": body.incassation_amount,
        "var": variance,
        "notes": body.notes,
        "created": datetime.now().isoformat(),
    })
    db.commit()

    return {
        "message": "Smena muvaffaqiyatli yopildi va inkassatsiya topshirildi ✓",
        "date": shift_info["date"],
        "cashier_name": user.full_name,
        "expected_cash": expected,
        "actual_cash": actual,
        "incassation_amount": body.incassation_amount,
        "variance": variance,
    }


@router.get("/history")
def get_incassation_history(
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    from sqlalchemy import text
    query = text("SELECT id, cashier_id, expected_cash, actual_cash, incassation_amount, variance, notes, created_at FROM shift_incassations ORDER BY created_at DESC LIMIT 50")
    rows = db.execute(query).fetchall()
    return [
        {
            "id": r[0],
            "cashier_id": r[1],
            "expected_cash": r[2],
            "actual_cash": r[3],
            "incassation_amount": r[4],
            "variance": r[5],
            "notes": r[6],
            "created_at": r[7],
        }
        for r in rows
    ]
