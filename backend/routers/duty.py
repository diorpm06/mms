from datetime import date, datetime
import json
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from auth_utils import require_admin_or_ceo, require_ceo
from database import get_db, SessionLocal
from models.app_setting import AppSetting
from models.duty_log import DutyLog
from models.user import User
from services.audit import log_audit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/duty", tags=["duty"])


class DutyCreate(BaseModel):
    employee_id: int
    duty_date: date
    shift: str
    note: str | None = None


def _get_setting(db: Session, key: str, default: str = "") -> str:
    item = db.query(AppSetting).filter(AppSetting.key == key).first()
    return item.value if (item and item.value is not None) else default


def _set_setting(db: Session, key: str, value: str):
    item = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not item:
        item = AppSetting(key=key, value=value)
        db.add(item)
    else:
        item.value = value
        item.updated_at = datetime.now()
    db.commit()


async def _send_telegram_report_bg(today: date):
    """Telegram botga kunlik PDF hisobot yuborish (fonda bajariladi)."""
    try:
        from services.export import export_pdf
        from services.reports_data import daily_report
        from services.telegram_notify import format_daily_message, send_telegram_document

        db = SessionLocal()
        try:
            rep = daily_report(db, today)
            pdf_bytes = export_pdf(rep, title=f"Marjona Med — Kunlik Hisobot ({today.strftime('%d.%m.%Y')})")
            msg = f"🔴 **SMENA TUGATILDI ({today.strftime('%d.%m.%Y')})**\n\n" + format_daily_message(db, today)
            filename = f"Kunlik_Hisobot_{today.strftime('%d.%m.%Y')}.pdf"
            await send_telegram_document(pdf_bytes, filename, caption=msg, section="reports")
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Background telegram notify warning: {e}")


@router.get("/shift-status")
def get_shift_status(db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    shift_mode = _get_setting(db, "shift_mode", "KUNDUZGI")
    shift_date = _get_setting(db, "shift_date", date.today().isoformat())
    closed_at = _get_setting(db, "shift_closed_at", "")
    started_at = _get_setting(db, "shift_started_at", "")
    from services.reports_data import get_active_shift_start
    active_start = get_active_shift_start(db)

    return {
        "shift_mode": shift_mode,  # "KUNDUZGI" | "TUNGI"
        "shift_date": shift_date,
        "today_date": date.today().isoformat(),
        "closed_at": closed_at,
        "started_at": started_at,
        "active_shift_start": active_start.isoformat(),
    }


@router.post("/close-shift")
async def close_shift(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    """Bugungi kunduzgi smenani tugatish: hisobotni Telegram botga uzatish, saqlash va tungi navbatchilik rejimiga o'tish."""
    today = date.today()
    today_str = today.isoformat()

    # 1. Tungi smenaga o'tish (zudlik bilan)
    _set_setting(db, "shift_mode", "TUNGI")
    _set_setting(db, "shift_closed_at", datetime.now().isoformat())

    # 2. Kunlik hisobotni saqlash (SavedReport)
    try:
        from models.saved_report import SavedReport
        from services.export import export_pdf
        from services.reports_data import daily_report

        rep = daily_report(db, today)
        pdf_bytes = export_pdf(rep, title=f"Marjona Med — Kunlik Hisobot ({today.strftime('%d.%m.%Y')})")

        saved = db.query(SavedReport).filter(
            SavedReport.report_type == "daily",
            SavedReport.period_start == today_str,
        ).first()

        if not saved:
            saved = SavedReport(
                report_type="daily",
                period_start=today_str,
                period_end=today_str,
                title=f"Kunlik Hisobot — {today.strftime('%d.%m.%Y')}",
                pdf_data=pdf_bytes,
                json_data=json.dumps(rep, default=str),
            )
            db.add(saved)
        else:
            saved.pdf_data = pdf_bytes
            saved.json_data = json.dumps(rep, default=str)
            saved.created_at = datetime.now()
        db.commit()
    except Exception as e:
        logger.warning(f"Close shift save report warning: {e}")

    log_audit(
        db,
        user_id=user.id,
        user_role=user.role,
        action_type="CLOSE_SHIFT",
        table_name="app_settings",
        record_id=0,
        old_data=f"🔴 Bugungi ({today.strftime('%d.%m.%Y')}) smena tugatildi va kunlik hisobot Telegram botga yuborildi.",
        new_data={"shift_mode": "TUNGI", "date": today_str},
    )

    # 3. Telegram botga PDF hisobotni uzatish (Vercel Serverless uchun to'g'ridan-to'g'ri)
    try:
        from services.telegram_notify import format_daily_message, send_telegram_document
        msg = f"🔴 **SMENA TUGATILDI ({today.strftime('%d.%m.%Y')})**\n\n" + format_daily_message(db, today)
        filename = f"Kunlik_Hisobot_{today.strftime('%d.%m.%Y')}.pdf"
        await send_telegram_document(pdf_bytes, filename, caption=msg, section="reports")
    except Exception as err:
        logger.warning(f"Close shift Telegram report send error: {err}")

    return {
        "message": f"Bugungi ({today.strftime('%d.%m.%Y')}) smena tugatildi! Kunlik hisobot Telegram botga yuborildi va Tungi Navbatchilik rejimi faollashdi.",
        "shift_mode": "TUNGI",
        "telegram_sent": True,
    }


@router.post("/start-shift")
def start_shift(
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    """Yangi kunduzgi smenani boshlash."""
    today = date.today()
    today_str = today.isoformat()

    _set_setting(db, "shift_mode", "KUNDUZGI")
    _set_setting(db, "shift_started_at", datetime.now().isoformat())
    _set_setting(db, "shift_date", today_str)

    log_audit(
        db,
        user_id=user.id,
        user_role=user.role,
        action_type="START_SHIFT",
        table_name="app_settings",
        record_id=0,
        old_data=f"🌅 Bugungi ({today.strftime('%d.%m.%Y')}) yangi ish kuni va kunduzgi smena muvaffaqiyatli boshlandi!",
        new_data={"shift_mode": "KUNDUZGI", "date": today_str},
    )

    return {
        "message": f"Bugungi ({today.strftime('%d.%m.%Y')}) yangi ish kuni va kunduzgi smena muvaffaqiyatli boshlandi!",
        "shift_mode": "KUNDUZGI",
        "shift_date": today_str,
    }


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
    existing = (
        db.query(DutyLog)
        .filter(DutyLog.duty_date == data.duty_date, DutyLog.employee_id == data.employee_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Bu kunda allaqachon dejur bor")
    d = DutyLog(**data.model_dump(), created_by=user.id)
    db.add(d)
    db.flush()
    from models.employee import Employee

    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    log_audit(
        db,
        user_id=user.id,
        user_role=user.role,
        action_type="CREATE",
        table_name="duty_logs",
        record_id=d.id,
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
