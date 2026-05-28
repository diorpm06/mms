from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from auth_utils import require_ceo
from database import get_db
from models.duty_log import DutyLog
from models.user import User
from services.audit import log_audit

router = APIRouter(prefix="/api/duty", tags=["duty"])


class DutyCreate(BaseModel):
    employee_id: int
    duty_date: date
    shift: str
    note: str | None = None


@router.get("")
def list_duty(
    duty_date: date | None = None,
    month: int | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    q = db.query(DutyLog).options(joinedload(DutyLog.employee))
    if duty_date:
        q = q.filter(DutyLog.duty_date == duty_date)
    elif year and month:
        from sqlalchemy import extract
        q = q.filter(extract("year", DutyLog.duty_date) == year, extract("month", DutyLog.duty_date) == month)
    items = q.order_by(DutyLog.duty_date.desc()).all()
    return [
        {
            "id": d.id,
            "duty_date": d.duty_date.isoformat(),
            "shift": d.shift,
            "note": d.note or "—",
            "employee_id": d.employee_id,
            "employee_name": d.employee.full_name if d.employee else "?",
        }
        for d in items
    ]


@router.post("")
def create_duty(
    data: DutyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_ceo),
):
    if data.shift not in ("kunduz", "tun"):
        raise HTTPException(status_code=400, detail="Smena: kunduz yoki tun")
    existing = db.query(DutyLog).filter(
        DutyLog.duty_date == data.duty_date, DutyLog.employee_id == data.employee_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu kunda allaqachon dejur bor")
    d = DutyLog(**data.model_dump(), created_by=user.id)
    db.add(d)
    db.flush()
    from models.employee import Employee
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="CREATE",
        table_name="duty_logs", record_id=d.id,
        new_data={"employee": emp.full_name if emp else "", "date": str(data.duty_date), "shift": data.shift},
    )
    db.commit()
    return {"id": d.id, "message": "Dejur tayinlandi"}


@router.delete("/{duty_id}")
def delete_duty(duty_id: int, db: Session = Depends(get_db), user: User = Depends(require_ceo)):
    d = db.query(DutyLog).filter(DutyLog.id == duty_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Topilmadi")
    db.delete(d)
    db.commit()
    return {"message": "O'chirildi"}
