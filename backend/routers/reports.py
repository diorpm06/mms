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
from services.reports_data import (
    admin_daily_report,
    daily_report,
    dashboard_summary,
    get_report,
    income_last_n_days,
    last_activity_date,
    monthly_report,
    referrer_patient_details,
    ten_day_report,
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
    daily = dashboard_summary(db, today)
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
            prev = dashboard_summary(db, last)
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


@router.get("/ten-day")
def report_ten_day(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    return ten_day_report(db, from_date, to_date)


@router.get("/referrer-patient-details")
def report_referrer_patient_details(
    referrer_id: int,
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    return referrer_patient_details(db, referrer_id, from_date, to_date)


@router.get("/top-referrers")
def report_top_referrers(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    from services.reports_data import top_referrers_analytics
    return top_referrers_analytics(db)


@router.get("/weekly")
def report_weekly(date_param: date = Query(..., alias="date"), db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    return weekly_report(db, date_param)


@router.get("/monthly")
def report_monthly(year: int, month: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    return monthly_report(db, year, month)


@router.get("/yearly")
def report_yearly(year: int, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    return yearly_report(db, year)


@router.get("/finance")
def report_finance(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    return get_report(db, from_date, to_date)


@router.get("/custom")
def report_custom(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    return get_report(db, from_date, to_date)


@router.post("/telegram/send-daily")
async def send_daily_telegram_report(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    from services.telegram_notify import format_daily_message, send_telegram_message
    msg = format_daily_message(db)
    await send_telegram_message(msg, section="reports")
    return {"message": "Kunlik hisobot Telegram botga muvaffaqiyatli uzatildi! 📤"}


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
    from services.export import export_excel
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
    _: User = Depends(require_admin_or_ceo),
):
    if type == "referrers":
        from services.export import export_referrers_pdf
        today = date.today()
        f_date = from_date or date_param or today
        t_date = to_date or today
        report = ten_day_report(db, f_date, t_date)
        content = export_referrers_pdf(report)
        return Response(
            content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=Yonaltiruvchilar_Hisobot_{f_date}_{t_date}.pdf"},
        )

    from services.export import export_pdf
    report = _resolve_report(db, type, date_param, year, month, from_date, to_date)
    content = export_pdf(report)
    return Response(
        content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=hisobot_{type}.pdf"},
    )


@router.get("/export/referrers-pdf")
def export_referrers_pdf_route(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    from services.export import export_referrers_pdf
    report = ten_day_report(db, from_date, to_date)
    content = export_referrers_pdf(report)
    return Response(
        content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Yonaltiruvchilar_Hisobot_{from_date}_{to_date}.pdf"},
    )


def _resolve_report(db, type, date_param, year, month, from_date, to_date):
    today = date.today()
    if type == "daily":
        return daily_report(db, date_param or today)
    if type == "ten_day" or type == "10day":
        f_date = from_date or (today - timedelta(days=9))
        t_date = to_date or today
        return ten_day_report(db, f_date, t_date)
    if type == "weekly":
        return weekly_report(db, date_param or today)
    if type == "monthly":
        return monthly_report(db, year or today.year, month or today.month)
    if type == "yearly":
        return yearly_report(db, year or today.year)
    return get_report(db, from_date or today, to_date or today)


# --- SAVED REPORTS ENDPOINTS ---

@router.get("/saved")
def get_saved_reports(
    type: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    import json
    from models.saved_report import SavedReport

    query = db.query(SavedReport)
    if type:
        query = query.filter(SavedReport.report_type == type)
    reports = query.order_by(SavedReport.created_at.desc()).all()

    return [
        {
            "id": r.id,
            "report_type": r.report_type,
            "period_start": r.period_start,
            "period_end": r.period_end,
            "title": r.title,
            "created_at": r.created_at.isoformat(),
            "has_pdf": r.pdf_data is not None,
            "data": json.loads(r.json_data) if r.json_data else None,
        }
        for r in reports
    ]


@router.get("/saved/{report_id}/pdf")
def download_saved_report_pdf(
    report_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    from fastapi import HTTPException
    from models.saved_report import SavedReport

    r = db.query(SavedReport).filter(SavedReport.id == report_id).first()
    if not r or not r.pdf_data:
        raise HTTPException(status_code=404, detail="PDF hisobot topilmadi")

    return Response(
        content=r.pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={r.report_type}_{r.period_start}.pdf"},
    )


@router.post("/save-daily")
def save_daily_report(
    date_param: date | None = Query(None, alias="date"),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    import json
    from models.saved_report import SavedReport
    from services.export import export_pdf

    d = date_param or date.today()
    rep = daily_report(db, d)
    pdf_bytes = export_pdf(rep, title=f"Marjona Med — Kunlik Hisobot ({d.strftime('%d.%m.%Y')})")

    d_str = d.isoformat()
    saved = db.query(SavedReport).filter(
        SavedReport.report_type == "daily",
        SavedReport.period_start == d_str,
    ).first()

    if not saved:
        saved = SavedReport(
            report_type="daily",
            period_start=d_str,
            period_end=d_str,
            title=f"Kunlik Hisobot — {d.strftime('%d.%m.%Y')}",
            pdf_data=pdf_bytes,
            json_data=json.dumps(rep, default=str),
        )
        db.add(saved)
    else:
        saved.pdf_data = pdf_bytes
        saved.json_data = json.dumps(rep, default=str)
        saved.created_at = datetime.now()

    db.commit()
    db.refresh(saved)
    return {"message": "Kunlik hisobot bazaga va PDF formatida saqlandi", "id": saved.id}


@router.post("/save-ten-day")
def save_ten_day_report(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    import json
    from models.saved_report import SavedReport
    from services.export import export_pdf

    rep = ten_day_report(db, from_date, to_date)
    pdf_bytes = export_pdf(rep, title=f"Marjona Med — 10-Kunlik Hisobot ({from_date.strftime('%d.%m')} — {to_date.strftime('%d.%m.%Y')})")

    saved = SavedReport(
        report_type="ten_day",
        period_start=from_date.isoformat(),
        period_end=to_date.isoformat(),
        title=f"10-Kunlik Hisobot ({from_date.strftime('%d.%m')} — {to_date.strftime('%d.%m.%Y')})",
        pdf_data=pdf_bytes,
        json_data=json.dumps(rep, default=str),
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)

    return {"message": "10-kunlik hisobot bazada saqlandi", "id": saved.id}


@router.delete("/saved/{report_id}")
def delete_saved_report(
    report_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    from fastapi import HTTPException
    from models.saved_report import SavedReport

    r = db.query(SavedReport).filter(SavedReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Hisobot topilmadi")

    db.delete(r)
    db.commit()
    return {"message": "Hisobot o'chirildi"}



@router.get("/analytics/forecast")
def analytics_forecast(db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    today = date.today()
    start_date = today - timedelta(days=30)
    
    patients = (
        db.query(Patient)
        .filter(
            Patient.created_at >= datetime.combine(start_date, datetime.min.time()),
            Patient.is_cancelled == False,
        )
        .all()
    )

    daily_revenue = {}
    for i in range(30):
        d = start_date + timedelta(days=i)
        daily_revenue[d.isoformat()] = 0

    for p in patients:
        d_str = p.created_at.date().isoformat()
        if d_str in daily_revenue:
            daily_revenue[d_str] += p.payment_amount

    rev_list = list(daily_revenue.values())
    avg_daily_rev = sum(rev_list) / max(len(rev_list), 1)
    projected_next_30_days = int(avg_daily_rev * 30)

    days_map = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]
    heatmap = {day: {h: 0 for h in range(8, 19)} for day in days_map}
    hour_counts = {h: 0 for h in range(8, 19)}

    for p in patients:
        day_name = days_map[p.created_at.weekday()]
        h = p.created_at.hour
        if 8 <= h <= 18:
            heatmap[day_name][h] += 1
            hour_counts[h] += 1

    busiest_hour = max(hour_counts, key=hour_counts.get) if hour_counts else 10

    return {
        "avg_daily_revenue": int(avg_daily_rev),
        "projected_next_30_days": projected_next_30_days,
        "historical_daily_revenue": [{"date": k, "revenue": v} for k, v in daily_revenue.items()],
        "heatmap": heatmap,
        "busiest_hour": f"{busiest_hour:02d}:00 - {busiest_hour+1:02d}:00",
        "total_30_day_patients": len(patients),
    }
