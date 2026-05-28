from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.advance import Advance
from models.balance import Balance
from models.duty_log import DutyLog
from models.expense import Expense
from models.inpatient import Inpatient, InpatientPayment
from models.patient import Patient
from models.referrer import Referrer
from models.salary_log import SalaryLog
from models.service import Service
from models.transaction import Transaction


def _day_range(d: date):
    start = datetime.combine(d, datetime.min.time())
    end = datetime.combine(d, datetime.max.time())
    return start, end


def _period_range(start: date, end: date):
    return (
        datetime.combine(start, datetime.min.time()),
        datetime.combine(end, datetime.max.time()),
    )


def _active_tx_filter(q):
    return q.filter(Transaction.is_cancelled == False)


def last_activity_date(db: Session) -> date | None:
    """Oxirgi to'lov bo'lgan kun."""
    last_dt = (
        _active_tx_filter(db.query(func.max(Transaction.created_at)))
        .scalar()
    )
    if not last_dt:
        return None
    if isinstance(last_dt, datetime):
        return last_dt.date()
    return last_dt


def get_report(db: Session, start: date, end: date) -> dict:
    s, e = _period_range(start, end)

    txs = _active_tx_filter(
        db.query(Transaction).filter(Transaction.created_at >= s, Transaction.created_at <= e)
    ).all()

    patients_q = db.query(Patient).filter(
        Patient.created_at >= s, Patient.created_at <= e, Patient.is_cancelled == False
    )
    all_patients = patients_q.all()
    patients_count = len(all_patients)

    phones_seen = set()
    new_count = 0
    repeat_count = 0
    for p in sorted(all_patients, key=lambda x: x.created_at):
        if p.phone in phones_seen:
            repeat_count += 1
        else:
            phones_seen.add(p.phone)
            new_count += 1

    total_income = sum(t.total_amount for t in txs)
    cash = sum(t.total_amount for t in txs if t.payment_type == "cash")
    card = sum(t.total_amount for t in txs if t.payment_type == "card")
    referrer_share = sum(t.referrer_amount for t in txs)
    provider_share = sum(t.provider_amount for t in txs)
    center_share = sum(t.center_amount for t in txs)

    expenses = (
        db.query(Expense)
        .filter(Expense.created_at >= s, Expense.created_at <= e, Expense.is_cancelled == False)
        .all()
    )
    expense_total = sum(x.amount for x in expenses)

    advances = (
        db.query(Advance)
        .filter(Advance.created_at >= s, Advance.created_at <= e, Advance.is_cancelled == False)
        .all()
    )
    advance_total = sum(a.amount for a in advances)
    salaries = (
        db.query(SalaryLog)
        .filter(SalaryLog.paid_at >= s, SalaryLog.paid_at <= e)
        .all()
    )
    salary_total = sum(x.amount for x in salaries)

    net_profit = center_share - expense_total - advance_total - salary_total

    active_inpatients = (
        db.query(Inpatient)
        .filter(Inpatient.status == "yotmoqda", Inpatient.is_cancelled == False)
        .count()
    )
    discharged_today = (
        db.query(Inpatient)
        .filter(
            Inpatient.discharged_at >= s,
            Inpatient.discharged_at <= e,
            Inpatient.status == "chiqdi",
            Inpatient.is_cancelled == False,
        )
        .count()
    )
    inpatient_income = (
        db.query(func.coalesce(func.sum(InpatientPayment.amount), 0))
        .filter(
            InpatientPayment.created_at >= s,
            InpatientPayment.created_at <= e,
            InpatientPayment.is_cancelled == False,
        )
        .scalar()
    )

    services_breakdown = (
        db.query(
            Service.name,
            func.count(Patient.id).label("cnt"),
            func.sum(Patient.payment_amount).label("total"),
        )
        .join(Patient, Patient.service_id == Service.id)
        .filter(
            Patient.created_at >= s,
            Patient.created_at <= e,
            Patient.is_cancelled == False,
        )
        .group_by(Service.id, Service.name)
        .order_by(func.sum(Patient.payment_amount).desc())
        .all()
    )

    referrers_breakdown = (
        db.query(
            Referrer.full_name,
            func.count(func.distinct(Transaction.patient_id)).label("cnt"),
            func.sum(Transaction.referrer_amount).label("total"),
        )
        .join(Transaction, Transaction.referrer_id == Referrer.id)
        .filter(
            Transaction.created_at >= s,
            Transaction.created_at <= e,
            Transaction.is_cancelled == False,
        )
        .group_by(Referrer.id, Referrer.full_name)
        .order_by(func.sum(Transaction.referrer_amount).desc())
        .limit(10)
        .all()
    )

    duty_date = end if start == end else date.today()

    from models.employee import Employee
    from sqlalchemy.orm import joinedload

    duty_today = (
        db.query(DutyLog)
        .options(joinedload(DutyLog.employee))
        .filter(DutyLog.duty_date == duty_date)
        .all()
    )

    duty_list = [
        {"name": d.employee.full_name if d.employee else "?", "shift": d.shift}
        for d in duty_today
    ]

    bal = db.query(Balance).first()
    current_balance = bal.current_balance if bal else 0

    chart = []
    d = start
    while d <= end:
        ds, de = _day_range(d)
        day_total = (
            db.query(func.coalesce(func.sum(Transaction.total_amount), 0))
            .filter(
                Transaction.created_at >= ds,
                Transaction.created_at <= de,
                Transaction.is_cancelled == False,
            )
            .scalar()
        )
        chart.append({"date": d.strftime("%d.%m"), "income": int(day_total or 0), "expenses": 0})
        d += timedelta(days=1)

    payment_chart = [
        {"name": "Naqt", "value": int(cash)},
        {"name": "Karta", "value": int(card)},
    ]
    finance_chart = [
        {"name": "Jami tushgan", "value": int(total_income)},
        {"name": "Yo'naltiruvchi", "value": int(referrer_share)},
        {"name": "Xizmat ko'rsatuvchi", "value": int(provider_share)},
        {"name": "Klinika ulushi", "value": int(center_share)},
        {"name": "Harajatlar", "value": int(expense_total)},
        {"name": "Maoshlar", "value": int(salary_total)},
        {"name": "Klinikada qolgan", "value": int(net_profit)},
    ]

    return {
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "patients_count": patients_count,
        "new_patients": new_count,
        "repeat_patients": repeat_count,
        "total_income": int(total_income),
        "cash": int(cash),
        "card": int(card),
        "referrer_share": int(referrer_share),
        "provider_share": int(provider_share),
        "center_share": int(center_share),
        "expenses": int(expense_total),
        "advances": int(advance_total),
        "salaries": int(salary_total),
        "net_profit": int(net_profit),
        "current_balance": int(current_balance),
        "active_inpatients": active_inpatients,
        "discharged_today": discharged_today,
        "inpatient_income": int(inpatient_income or 0),
        "services_breakdown": [
            {"name": r[0], "count": r[1], "total": int(r[2] or 0)} for r in services_breakdown
        ],
        "referrers_breakdown": [
            {"name": r[0], "count": r[1], "total": int(r[2] or 0)} for r in referrers_breakdown
        ],
        "duty_today": duty_list,
        "income_chart": chart,
        "payment_chart": payment_chart,
        "finance_chart": finance_chart,
    }


def admin_daily_report(db: Session, d: date) -> dict:
    """Admin uchun — foizlar, sof foyda va ichki taqsimot yo'q."""
    full = get_report(db, d, d)
    out = {
        "patients_count": full["patients_count"],
        "new_patients": full["new_patients"],
        "repeat_patients": full["repeat_patients"],
        "total_income": full["total_income"],
        "cash": full["cash"],
        "card": full["card"],
        "expenses": full["expenses"],
        "services_breakdown": full["services_breakdown"],
        "payment_chart": full["payment_chart"],
        "report_date": d.isoformat(),
    }
    if out["patients_count"] == 0 and out["total_income"] == 0:
        last = last_activity_date(db)
        if last and last != d:
            out["suggested_date"] = last.isoformat()
    return out


def daily_report(db: Session, d: date) -> dict:
    return get_report(db, d, d)


def weekly_report(db: Session, d: date) -> dict:
    start = d - timedelta(days=d.weekday())
    end = start + timedelta(days=6)
    return get_report(db, start, end)


def monthly_report(db: Session, year: int, month: int) -> dict:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)
    return get_report(db, start, end)


def yearly_report(db: Session, year: int) -> dict:
    return get_report(db, date(year, 1, 1), date(year, 12, 31))


def top_referrers(db: Session, limit: int = 10):
    return (
        db.query(
            Referrer.id,
            Referrer.full_name,
            func.count(func.distinct(Transaction.patient_id)).label("count"),
            func.sum(Transaction.referrer_amount).label("total"),
        )
        .join(Transaction, Transaction.referrer_id == Referrer.id)
        .filter(Transaction.is_cancelled == False)
        .group_by(Referrer.id, Referrer.full_name)
        .order_by(func.sum(Transaction.referrer_amount).desc())
        .limit(limit)
        .all()
    )


def referrer_patient_details(db: Session, referrer_id: int, start: date, end: date):
    s, e = _period_range(start, end)
    rows = (
        db.query(
            Patient.id,
            Patient.first_name,
            Patient.last_name,
            Service.name.label("service_name"),
            Provider.full_name.label("provider_name"),
            Transaction.total_amount,
            Transaction.referrer_amount,
            Transaction.created_at,
            Referrer.percentage,
        )
        .join(Transaction, Transaction.patient_id == Patient.id)
        .join(Service, Service.id == Patient.service_id)
        .join(Provider, Provider.id == Patient.provider_id)
        .join(Referrer, Referrer.id == Transaction.referrer_id)
        .filter(
            Transaction.referrer_id == referrer_id,
            Transaction.created_at >= s,
            Transaction.created_at <= e,
            Transaction.is_cancelled == False,
        )
        .order_by(Transaction.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "patient_id": r[0],
            "patient_name": f"{r[1]} {r[2]}",
            "service_name": r[3],
            "provider_name": r[4],
            "total_amount": int(r[5] or 0),
            "referrer_amount": int(r[6] or 0),
            "referrer_percent": int(r[8] or 0),
            "created_at": r[7].isoformat(),
        }
        for r in rows
    ]


def top_services(db: Session, limit: int = 10):
    return (
        db.query(
            Service.name,
            func.count(Patient.id).label("count"),
            func.sum(Patient.payment_amount).label("total"),
        )
        .join(Patient, Patient.service_id == Service.id)
        .filter(Patient.is_cancelled == False)
        .group_by(Service.id, Service.name)
        .order_by(func.sum(Patient.payment_amount).desc())
        .limit(limit)
        .all()
    )


def income_last_n_days(db: Session, days: int = 7):
    result = []
    today = date.today()
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        ds, de = _day_range(d)
        total = (
            db.query(func.coalesce(func.sum(Transaction.total_amount), 0))
            .filter(
                Transaction.created_at >= ds,
                Transaction.created_at <= de,
                Transaction.is_cancelled == False,
            )
            .scalar()
        )
        result.append({"date": d.strftime("%d.%m"), "income": int(total or 0)})
    return result
