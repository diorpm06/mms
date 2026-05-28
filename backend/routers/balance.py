from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from auth_utils import require_ceo
from database import get_db
from models.balance import Balance, BalanceHistory
from models.user import User
from schemas import BalanceHistoryOut, BalanceOut
from services.finance import get_or_create_balance

router = APIRouter(prefix="/api/balance", tags=["balance"])


@router.get("", response_model=BalanceOut)
def get_balance(db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    bal = get_or_create_balance(db)
    db.commit()
    return BalanceOut(current_balance=bal.current_balance, updated_at=bal.updated_at)


@router.get("/history", response_model=list[BalanceHistoryOut])
def balance_history(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    q = db.query(BalanceHistory)
    if from_date:
        q = q.filter(BalanceHistory.created_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        q = q.filter(BalanceHistory.created_at <= datetime.combine(to_date, datetime.max.time()))
    return q.order_by(BalanceHistory.created_at.desc()).limit(200).all()
