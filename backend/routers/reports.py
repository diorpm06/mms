from datetime import date, datetime, timedelta
from typing import Optional

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
    admin_dashboard_summary,
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
    from services.reports_data import top_departments
    today = date.today()
    daily = dashboard_summary(db, today)
    chart = income_last_n_days(db, 10)
    # Rahbar panelidagi kartalar — Rasm 3 bo'yicha Top 5 Bo'lim (UZI, Laboratoriya, Massaj, etc.)
    tops = top_departments(db, 5)
    refs = top_referrers(db, 5)
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

    # Umumiy tushum bo'limi: oylik, yillik va kunlik o'rtacha tushum.
    # Bugungi kartadan farqli — bular jamlangan davrlar bo'yicha.
    month_report = monthly_report(db, today.year, today.month)
    year_report = yearly_report(db, today.year)
    # O'rtacha = yillik jami / yilning bugungi kungacha bo'lgan kun
    # tartib raqami (masalan 25-avgust — 237-kun, shunga bo'linadi;
    # ertaga 238-kunga). Yil oxirigacha kuzatilib boriladi.
    days_elapsed_this_year = (today - date(today.year, 1, 1)).days + 1
    avg_daily_income = int(year_report["total_income"] / max(days_elapsed_this_year, 1))

    return {
        "daily_income": daily["total_income"],
        "current_balance": daily["current_balance"],
        "today_patients": daily["patients_count"],
        "paper_income": daily.get("paper_income", 0),
        "paper_count": daily.get("paper_count", 0),
        "month_expenses": int(month_exp or 0),
        "month_income": int(month_report["total_income"]),
        "year_income": int(year_report["total_income"]),
        "avg_daily_income": avg_daily_income,
        "income_chart": chart,
        "top_services": [{"name": t[0], "count": t[1], "total": int(t[2] or 0)} for t in tops],
        "top_referrers": [{"id": t[0], "name": t[1], "count": int(t[2] or 0), "total": int(t[3] or 0)} for t in refs],
        "last_activity": last_activity,
    }


@router.get("/revenue-summary")
def revenue_summary(
    period: str = Query("day", pattern="^(day|month|year)$"),
    date_param: Optional[date] = Query(None, alias="date"),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    """Rahbar Dashboard'dagi Kun/Oy/Yil tanlagichi uchun — istalgan
    kun, oy yoki yilning jami tushumini qaytaradi."""
    today = date.today()
    if period == "day":
        d = date_param or today
        rep = dashboard_summary(db, d)
        return {"period": "day", "date": d.isoformat(), "income": int(rep["total_income"])}
    elif period == "month":
        y = year or today.year
        m = month or today.month
        rep = monthly_report(db, y, m)
        return {"period": "month", "year": y, "month": m, "income": int(rep["total_income"])}
    else:
        y = year or today.year
        rep = yearly_report(db, y)
        return {"period": "year", "year": y, "income": int(rep["total_income"])}


@router.get("/admin-daily")
def report_admin_daily(
    date_param: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    target_date = date_param or date.today()
    return admin_daily_report(db, target_date)


@router.get("/admin-summary")
def report_admin_summary(
    date_param: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """Admin bosh sahifasi uchun yengil xulosa (3 ta SQL so'rov)."""
    target_date = date_param or date.today()
    return admin_dashboard_summary(db, target_date)


@router.get("/period-chart")
def report_period_chart(
    period: str = Query("7days"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    from services.reports_data import income_by_period
    return income_by_period(db, period)


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
    from services.telegram_notify import format_daily_message, send_telegram_document
    from services.export import export_pdf
    from services.reports_data import get_report

    today = date.today()
    rep = get_report(db, today, today)
    pdf_bytes = export_pdf(rep, title=f"Marjona Med — Kunlik Hisobot ({today.strftime('%d.%m.%Y')})")
    msg = format_daily_message(db, today)
    filename = f"Kunlik_Hisobot_{today.strftime('%d.%m.%Y')}.pdf"
    await send_telegram_document(pdf_bytes, filename, caption=msg, section="reports")
    return {"message": "Kunlik hisobot PDF fayli bilan birga Telegram botga muvaffaqiyatli uzatildi! 📤"}


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
    phone_clean = (p.phone or "").strip()
    if phone_clean and phone_clean not in ("-", "None", "", "null"):
        visits = db.query(Patient).filter(Patient.phone == phone_clean).order_by(Patient.created_at.desc()).all()
    else:
        visits = db.query(Patient).filter(Patient.id == p.id).all()
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
    user: User = Depends(require_admin_or_ceo),
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
    report = _pdf_uchun_tozala(report, user.role, type)
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


def _pdf_uchun_tozala(report: dict, rol: str, tur: str) -> dict:
    """PDF ga chiqmasligi kerak bo'lgan ichki ma'lumotni olib tashlaydi.

    Ikki muammo bor edi:

    1) Admin "PDF Yuklab Olish" / "Chop Etish" bosganda CEO darajasidagi
       to'liq hisobot ishlatilardi. Ekranda admin uchun foizlar va ichki
       taqsimot ataylab yashiringan (admin_daily_report), PDF da esa
       shifokorlarning KPI ulushlari ochiq chiqib ketardi.

    2) "SHIFOKORLAR KPI ULUSHLARI (10 KUNLIK / DAVRIY)" jadvali nomidan
       ko'rinib turibdiki davriy hisobot uchun. Lekin u KUNLIK hisobotga
       ham tushib qolgan edi.
    """
    toza = dict(report)

    # Kunlik hisobotda KPI jadvali umuman bo'lmaydi — u davriy hisobot uchun
    if tur in ("daily", "custom"):
        toza.pop("providers_breakdown", None)

    # Adminga shifokorlar ulushi va ichki moliya ko'rsatilmaydi
    if rol != "ceo":
        for maydon in ("providers_breakdown", "referrers_breakdown",
                       "provider_share", "center_share", "net_profit",
                       "current_balance", "advances", "salaries"):
            toza.pop(maydon, None)

    return toza


def _resolve_report(db, type, date_param, year, month, from_date, to_date):
    today = date.today()
    if from_date and to_date and not date_param and type in ("daily", "custom"):
        return ten_day_report(db, from_date, to_date)
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
