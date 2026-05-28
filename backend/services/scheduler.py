import asyncio
import logging
from calendar import monthrange
from datetime import date, datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from database import SessionLocal
from models.provider import Provider
from models.referrer import Referrer
from services.audit import log_audit
from services.finance import process_monthly_salaries, process_ten_day_payouts
from services.reports_data import daily_report
from services.salary_reminder import load_salary_reminder, save_salary_reminder, should_send_now
from services.sheets_backup import sync_from_configured_url
from services.telegram_notify import format_daily_message, send_telegram_message

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(coro)


def _with_db(fn):
    db = SessionLocal()
    try:
        fn(db)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Scheduler xato: %s", e)
    finally:
        db.close()


def job_daily_report():
    def _job(db: Session):
        msg = format_daily_message(db)
        _run_async(send_telegram_message(msg, section="reports"))

    _with_db(_job)


def job_weekly_report():
    from services.telegram_notify import format_weekly_message

    def _job(db: Session):
        msg = format_weekly_message(db)
        _run_async(send_telegram_message(msg, section="reports"))

    _with_db(_job)


def job_monthly_report_and_salary():
    from services.telegram_notify import format_monthly_message

    def _job(db: Session):
        try:
            process_monthly_salaries(db)
            msg = format_monthly_message(db)
            msg = "💼 Oylik maoshlar to'landi.\n\n" + msg
            _run_async(send_telegram_message(msg, section="reports"))
        except Exception as e:
            logger.error("Oylik maosh xato: %s", e)
            _run_async(send_telegram_message(f"❌ Oylik maosh xato: {e}", section="system"))

    _with_db(_job)


def job_ten_day_payout():
    today = date.today()
    if today.day <= 10:
        period_start = today.replace(day=1)
    elif today.day <= 20:
        period_start = today.replace(day=11)
    else:
        period_start = today.replace(day=21)
    period_end = today - timedelta(days=1) if today.day in (10, 20) else today

    def _job(db: Session):
        payouts = process_ten_day_payouts(db, period_start, period_end)
        total = sum(p.amount for p in payouts)
        lines = []
        for p in payouts:
            if p.recipient_type == "referrer":
                obj = db.query(Referrer).filter(Referrer.id == p.recipient_id).first()
            else:
                obj = db.query(Provider).filter(Provider.id == p.recipient_id).first()
            name = obj.full_name if obj else f"#{p.recipient_id}"
            role = "Yo'naltiruvchi" if p.recipient_type == "referrer" else "Provider"
            lines.append(f"- {role}: {name} — {p.amount:,} so'm".replace(",", " "))
        details = "\n".join(lines[:30]) if lines else "—"
        msg = (
            f"📤 10 kunlik foiz chiqarimi\n"
            f"Davr: {period_start.strftime('%d.%m.%Y')} — {period_end.strftime('%d.%m.%Y')}\n"
            f"Jami: {total:,} so'm ({len(payouts)} ta)\n\n"
            f"Kimga qancha:\n{details}".replace(",", " ")
        )
        _run_async(send_telegram_message(msg, section="finance"))

    _with_db(_job)


def job_salary_reminder():
    if not should_send_now():
        return

    def _job(db: Session):
        cfg = load_salary_reminder()
        today = datetime.now().strftime("%Y-%m-%d")
        log_audit(
            db,
            user_id=None,
            user_role="system",
            action_type="SALARY",
            table_name="salary_reminder",
            detail_message="Maosh eslatmasi: bugun xodimlar oyligini tekshiring.",
        )
        cfg["last_sent_date"] = today
        save_salary_reminder(cfg)

    _with_db(_job)


def job_sheets_backup_sync():
    def _job(db: Session):
        try:
            sync_from_configured_url(db)
        except Exception as e:
            logger.error("Sheets backup sync xato: %s", e)

    _with_db(_job)


def start_scheduler():
    if scheduler.running:
        return
    scheduler.add_job(job_daily_report, "cron", hour=0, minute=0, id="daily_report")
    scheduler.add_job(job_weekly_report, "cron", day_of_week="sun", hour=0, minute=0, id="weekly_report")
    scheduler.add_job(job_monthly_report_and_salary, "cron", day="last", hour=0, minute=0, id="monthly")
    scheduler.add_job(job_ten_day_payout, "cron", day="10,20,last", hour=0, minute=0, id="ten_day_payout")
    scheduler.add_job(job_salary_reminder, "interval", minutes=1, id="salary_reminder")
    scheduler.add_job(job_sheets_backup_sync, "interval", minutes=2, id="sheets_backup_sync")
    scheduler.start()
    logger.info("APScheduler ishga tushdi")
