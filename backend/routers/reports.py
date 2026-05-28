from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from auth_utils import require_admin_or_ceo, require_ceo
from database import get_db
from models.patient import Patient
from models.payout import Payout
from models.transaction import Transaction
from models.user import User
from services.export import export_excel, export_pdf
from services.reports_data import (
    admin_daily_report,
    daily_report,
    get_report,
    income_last_n_days,
    last_activity_date,
    monthly_report,
    referrer_patient_details,
    top_referrers,
    top_services,
    weekly_report,
    yearly_report,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/dashboard")
def ceo_dashboard(db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    from sqlalchemy import func
    from models.expense import Expense

    today = date.today()
    daily = daily_report(db, today)
    chart = income_last_n_days(db, 7)
    tops = top_services(db, 3)
    refs = top_referrers(db, 3)
    month_start = today.replace(day=1)
    month_start_dt, month_end_dt = (
        datetime.combine(month_start, datetime.min.time()),
        datetime.combine(today, datetime.max.time()),
    )
    month_exp = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.created_at >= month_start_dt,
            Expense.created_at <= month_end_dt,
            Expense.is_cancelled == False,
        )
        .scalar()
    )

    last_activity = None
    if daily["patients_count"] == 0 and daily["total_income"] == 0:
        last = last_activity_date(db)
        if last and last != today:
            prev = daily_report(db, last)
            last_activity = {
                "date": last.isoformat(),
                "date_label": last.strftime("%d.%m.%Y"),
                "income": prev["total_income"],
                "patients": prev["patients_count"],
            }

    return {
        "daily_income": daily["total_income"],
        "current_balance": daily["current_balance"],
        "today_patients": daily["patients_count"],
        "month_expenses": int(month_exp or 0),
        "income_chart": chart,
        "top_services": [{"name": t[0], "count": t[1], "total": int(t[2] or 0)} for t in tops],
        "top_referrers": [{"id": t[0], "name": t[1], "count": int(t[2] or 0), "total": int(t[3] or 0)} for t in refs],
        "last_activity": last_activity,
    }


@router.get("/admin-daily")
def report_admin_daily(
    date_param: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    return admin_daily_report(db, date_param)


@router.get("/daily")
def report_daily(
    date_param: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    return daily_report(db, date_param)


@router.get("/weekly")
def report_weekly(date_param: date = Query(..., alias="date"), db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    return weekly_report(db, date_param)


@router.get("/monthly")
def report_monthly(year: int, month: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    return monthly_report(db, year, month)


@router.get("/yearly")
def report_yearly(year: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    return yearly_report(db, year)


@router.get("/custom")
def report_custom(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    return get_report(db, from_date, to_date)


@router.get("/payouts")
def report_payouts(period: str = "10day", db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    payouts = db.query(Payout).order_by(Payout.created_at.desc()).limit(100).all()
    return [
        {
            "id": p.id,
            "recipient_type": p.recipient_type,
            "recipient_id": p.recipient_id,
            "amount": p.amount,
            "period_start": p.period_start.isoformat(),
            "period_end": p.period_end.isoformat(),
            "created_at": p.created_at.isoformat(),
        }
        for p in payouts
    ]


@router.get("/top-referrers")
def report_top_referrers(db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    return [{"id": r[0], "name": r[1], "count": int(r[2] or 0), "total": int(r[3] or 0)} for r in top_referrers(db)]


@router.get("/referrer-details/{referrer_id}")
def report_referrer_details(
    referrer_id: int,
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    today = date.today()
    start = from_date or today.replace(day=1)
    end = to_date or today
    return referrer_patient_details(db, referrer_id, start, end)


@router.get("/top-services")
def report_top_services(db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    return [{"name": s[0], "count": s[1], "total": int(s[2] or 0)} for s in top_services(db)]


@router.get("/patient-visits/{patient_id}")
def report_patient_visits(patient_id: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        return []
    visits = db.query(Patient).filter(Patient.phone == p.phone).order_by(Patient.created_at.desc()).all()
    return [{"id": v.id, "amount": v.payment_amount, "created_at": v.created_at.isoformat()} for v in visits]


@router.get("/export/excel")
def export_report_excel(
    type: str = "daily",
    date_param: date | None = Query(None, alias="date"),
    year: int | None = None,
    month: int | None = None,
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    report = _resolve_report(db, type, date_param, year, month, from_date, to_date)
    content = export_excel(report)
    return Response(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=hisobot_{type}.xlsx"},
    )


@router.get("/export/pdf")
def export_report_pdf(
    type: str = "daily",
    date_param: date | None = Query(None, alias="date"),
    year: int | None = None,
    month: int | None = None,
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    report = _resolve_report(db, type, date_param, year, month, from_date, to_date)
    content = export_pdf(report)
    return Response(
        content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=hisobot_{type}.pdf"},
    )


def _resolve_report(db, type, date_param, year, month, from_date, to_date):
    today = date.today()
    if type == "daily":
        return daily_report(db, date_param or today)
    if type == "weekly":
        return weekly_report(db, date_param or today)
    if type == "monthly":
        return monthly_report(db, year or today.year, month or today.month)
    if type == "yearly":
        return yearly_report(db, year or today.year)
    return get_report(db, from_date or today, to_date or today)
