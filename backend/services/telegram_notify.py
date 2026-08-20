import logging
from datetime import date

import httpx

from config import settings
from services.telegram_links import resolve_targets
from services.reports_data import daily_report, get_report, monthly_report, weekly_report

logger = logging.getLogger(__name__)


def _format_report_message(report: dict, title: str) -> str:
  d_start = report.get("period_start", "")
  if d_start == report.get("period_end", ""):
      try:
          parts = d_start.split("-")
          date_label = f"{parts[2]}.{parts[1]}.{parts[0]}"
      except Exception:
          date_label = d_start
  else:
      date_label = f"{d_start} — {report.get('period_end', '')}"

  def m(n):
      return f"{n:,}".replace(",", " ")

  return (
      f"📊 {title}\n"
      f"📅 Sana: {date_label}\n"
      f"👥 Mijozlar: {report.get('patients_count', 0)} nafar\n"
      f"💰 Jami daromad: {m(report.get('total_income', 0))} so'm\n"
      f"💵 Naqt: {m(report.get('cash', 0))} so'm\n"
      f"💳 Karta: {m(report.get('card', 0))} so'm\n"
      f"📤 Yo'naltiruvchi hissi: {m(report.get('referrer_share', 0))} so'm\n"
      f"📤 Xizmat ko'rs. hissi: {m(report.get('provider_share', 0))} so'm\n"
      f"🏦 Markaz ulushi: {m(report.get('center_share', 0))} so'm\n"
      f"🧾 Harajatlar: {m(report.get('expenses', 0))} so'm\n"
      f"✅ Sof daromad: {m(report.get('net_profit', 0))} so'm\n"
      f"💼 Joriy balans: {m(report.get('current_balance', 0))} so'm"
  )


TOPIC_MAP = {
    "registration": "TELEGRAM_TOPIC_REGISTRATION",
    "inpatients": "TELEGRAM_TOPIC_INPATIENTS",
    "finance": "TELEGRAM_TOPIC_FINANCE",
    "reports": "TELEGRAM_TOPIC_REPORTS",
    "cancellations": "TELEGRAM_TOPIC_CANCELLATIONS",
    "system": "TELEGRAM_TOPIC_SYSTEM",
}


def _target_chat_ids() -> list[str]:
    ids: list[str] = []
    if settings.TELEGRAM_CHAT_IDS.strip():
        ids.extend([x.strip() for x in settings.TELEGRAM_CHAT_IDS.split(",") if x.strip()])
    if settings.TELEGRAM_CHAT_ID.strip():
        ids.append(settings.TELEGRAM_CHAT_ID.strip())
    return list(dict.fromkeys(ids))


async def send_telegram_message(text: str, section: str = "system"):
    chat_ids = _target_chat_ids()
    if not settings.BOT_TOKEN:
        logger.warning("Telegram sozlanmagan")
        return
    url = f"https://api.telegram.org/bot{settings.BOT_TOKEN}/sendMessage"
    topic_key = TOPIC_MAP.get(section)
    topic_id = getattr(settings, topic_key, None) if topic_key else None
    try:
        # default env targets
        targets: list[tuple[str, int | None]] = []
        parsed_topic = int(topic_id) if str(topic_id).strip().isdigit() else None
        for cid in chat_ids:
            targets.append((cid, parsed_topic))
        # dynamically linked targets from bot /ulash
        for linked in resolve_targets(section):
            if linked not in targets:
                targets.append(linked)
        if not targets:
            logger.warning("Telegram target topilmadi: section=%s", section)
            return

        async with httpx.AsyncClient(timeout=2.0) as client:
            for chat_id, thread_id in targets:
                payload = {"chat_id": chat_id, "text": text}
                if thread_id:
                    payload["message_thread_id"] = int(thread_id)
                resp = await client.post(url, json=payload)
                if resp.status_code >= 400:
                    logger.error("Telegram yuborilmadi (%s): %s", resp.status_code, resp.text[:300])
    except Exception as e:
        logger.error("Telegram xabar xato: %s", e)


async def send_telegram_document(document_bytes: bytes, filename: str, caption: str = "", section: str = "reports"):
    chat_ids = _target_chat_ids()
    if not settings.BOT_TOKEN:
        logger.warning("Telegram sozlanmagan")
        return
    url = f"https://api.telegram.org/bot{settings.BOT_TOKEN}/sendDocument"
    topic_key = TOPIC_MAP.get(section)
    topic_id = getattr(settings, topic_key, None) if topic_key else None
    try:
        targets: list[tuple[str, int | None]] = []
        parsed_topic = int(topic_id) if str(topic_id).strip().isdigit() else None
        for cid in chat_ids:
            targets.append((cid, parsed_topic))
        for linked in resolve_targets(section):
            if linked not in targets:
                targets.append(linked)
        if not targets:
            logger.warning("Telegram target topilmadi: section=%s", section)
            return

        async with httpx.AsyncClient(timeout=30.0) as client:
            for chat_id, thread_id in targets:
                data = {"chat_id": chat_id, "caption": caption[:1024]}
                if thread_id:
                    data["message_thread_id"] = str(thread_id)
                files = {"document": (filename, document_bytes, "application/pdf")}
                resp = await client.post(url, data=data, files=files)
                if resp.status_code >= 400:
                    logger.error("Telegram document yuborilmadi (%s): %s", resp.status_code, resp.text[:300])
    except Exception as e:
        logger.error("Telegram document xato: %s", e)


def send_telegram_background(text: str, section: str = "system") -> None:
    """Telegram xabarini alohida fon oqimida (daemon thread) yuboradi.
    FastAPI API javobi telegram sababli 1 millisekund ham ushlanib qolmaydi!
    """
    import asyncio
    import threading

    def _worker():
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(send_telegram_message(text, section=section))
            loop.close()
        except Exception as e:
            logger.warning("Telegram background xatosi: %s", e)

    threading.Thread(target=_worker, daemon=True).start()


def format_daily_message(db, d: date | None = None) -> str:
    d = d or date.today()
    report = daily_report(db, d)
    return _format_report_message(report, "KUNLIK HISOBOT")


def format_weekly_message(db, d: date | None = None) -> str:
    d = d or date.today()
    report = weekly_report(db, d)
    return _format_report_message(report, "HAFTALIK HISOBOT")


def format_monthly_message(db, d: date | None = None) -> str:
    d = d or date.today()
    report = monthly_report(db, d.year, d.month)
    return _format_report_message(report, "OYLIK HISOBOT")


def format_custom_message(db, start: date, end: date) -> str:
    report = get_report(db, start, end)
    return _format_report_message(report, "MUDDATLI HISOBOT")
