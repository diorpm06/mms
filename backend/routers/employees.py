from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth_utils import require_ceo
from database import get_db
from models.employee import Employee
from models.user import User
from schemas import EmployeeCreate, EmployeeOut, EmployeeUpdate
from services.finance import employee_payroll_summary, pay_employee_salary
from services.reports_data import daily_report
from services.salary_reminder import load_salary_reminder, save_salary_reminder
from services.telegram_notify import send_telegram_message

router = APIRouter(prefix="/api/employees", tags=["employees"])


class SalaryReminderBody(BaseModel):
    enabled: bool = True
    time: str = Field(default="09:00", pattern=r"^\d{2}:\d{2}$")
    day_of_month: int = Field(default=1, ge=1, le=31)
    month: int = Field(default=0, ge=0, le=12)


@router.get("", response_model=list[EmployeeOut])
def list_employees(
    include_inactive: bool = Query(True),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo)
):
    q = db.query(Employee)
    if not include_inactive:
        q = q.filter(Employee.is_active == True)
    return q.order_by(Employee.full_name).all()


@router.post("", response_model=EmployeeOut)
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    e = Employee(**data.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


@router.put("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int, data: EmployeeUpdate, db: Session = Depends(get_db), _: User = Depends(require_ceo)
):
    e = db.query(Employee).filter(Employee.id == employee_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    db.commit()
    db.refresh(e)
    return e


@router.delete("/{employee_id}")
def delete_employee(
    employee_id: int,
    hard: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo)
):
    e = db.query(Employee).filter(Employee.id == employee_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    if hard:
        db.delete(e)
    else:
        e.is_active = not e.is_active
    db.commit()
    return {"message": "Status o'zgartirildi / O'chirildi", "is_active": e.is_active if not hard else False}



@router.post("/{employee_id}/pay-salary")
async def pay_salary(employee_id: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    summary = employee_payroll_summary(db, employee_id)
    log = pay_employee_salary(db, employee_id)
    db.commit()
    report = daily_report(db, datetime.now().date())
    await send_telegram_message(
        f"💼 Qo'lda maosh: {log.amount:,} so'm (xodim #{employee_id})".replace(",", " "),
        section="finance",
    )
    return {
        "message": "Maosh to'landi",
        "amount": log.amount,
        "month": summary["month"],
        "base_salary": summary["base_salary"],
        "advances_total": summary["advances_total"],
        "current_balance": report["current_balance"],
        "net_profit": report["net_profit"],
    }


from models.salary_log import SalaryLog


@router.get("/{employee_id}/salary-history")
def salary_history(employee_id: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    logs = (
        db.query(SalaryLog)
        .filter(SalaryLog.employee_id == employee_id)
        .order_by(SalaryLog.paid_at.desc())
        .limit(24)
        .all()
    )
    return [{"id": l.id, "amount": l.amount, "month": l.month, "paid_at": l.paid_at.isoformat()} for l in logs]


@router.get("/{employee_id}/payroll-summary")
def get_payroll_summary(
    employee_id: int,
    month: str | None = Query(None, description="YYYY-MM"),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    if month:
        try:
            datetime.strptime(month, "%Y-%m")
        except ValueError as e:
            raise HTTPException(status_code=400, detail="month formati noto'g'ri, YYYY-MM bo'lishi kerak") from e
    return employee_payroll_summary(db, employee_id, month)


@router.get("/salary-reminder/config")
def get_salary_reminder(_: User = Depends(require_ceo)):
    return load_salary_reminder()


@router.post("/salary-reminder/config")
def set_salary_reminder(body: SalaryReminderBody, _: User = Depends(require_ceo)):
    hh, mm = body.time.split(":")
    if int(hh) > 23 or int(mm) > 59:
        raise HTTPException(status_code=400, detail="Vaqt noto'g'ri")
    cfg = load_salary_reminder()
    cfg["enabled"] = body.enabled
    cfg["time"] = body.time
    cfg["day_of_month"] = body.day_of_month
    cfg["month"] = body.month
    if not body.enabled:
        cfg["last_sent_date"] = ""
    save_salary_reminder(cfg)
    return cfg
