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

  net_cash_val = report.get('net_cash', max(0, report.get('cash', 0) - report.get('expenses', 0)))

  return (
      f"📊 {title}\n"
      f"📅 Sana: {date_label}\n"
      f"👥 Mijozlar: {report.get('patients_count', 0)} nafar\n"
      f"💰 Jami daromad: {m(report.get('total_income', 0))} so'm\n"
      f"💵 Naqt tushum: {m(report.get('cash', 0))} so'm\n"
      f"💳 Karta/QR: {m(report.get('card', 0) + report.get('click', 0) + report.get('qr', 0))} so'm\n"
      f"📤 Yo'naltiruvchi hissi: {m(report.get('referrer_share', 0))} so'm\n"
      f"📤 Xizmat ko'rs. hissi: {m(report.get('provider_share', 0))} so'm\n"
      f"🏦 Markaz ulushi: {m(report.get('center_share', 0))} so'm\n"
      f"🧾 Harajatlar: {m(report.get('expenses', 0))} so'm\n"
      f"💵 Kassada qolgan naqd: {m(net_cash_val)} so'm\n"
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
    # CEO_CHAT_ID ilgari faqat bot BUYRUQLARIGA ruxsat berish uchun
    # ishlatilardi (kirish tekshiruvi), lekin CHIQUVCHI (avtomatik)
    # xabarlar ro'yxatida umuman yo'q edi. Ya'ni faqat shuni sozlagan
    # odam ham botga buyruq yoza olardi, ham hech qanday avtomatik
    # hisobot olmasdi — ikkalasi mos kelishi kerak.
    if settings.CEO_CHAT_ID.strip():
        ids.append(settings.CEO_CHAT_ID.strip())
    return list(dict.fromkeys(ids))


async def send_telegram_message(text: str, section: str = "system") -> bool:
    """`True` — kamida bitta chatga muvaffaqiyatli yuborilgan bo'lsa.
    Ilgari bu funksiya hech narsa qaytarmasdi — chaqiruvchi kod (masalan
    "Telegramga yuborish" tugmasi) hech qachon HAQIQATDA yuborilganini
    tekshirmasdan "✓ yuborildi" deb ko'rsatib turaverardi, hatto
    sozlanган chat/bog'lanish umuman bo'lmasa ham (jim muvaffaqiyatsizlik)."""
    chat_ids = _target_chat_ids()
    if not settings.BOT_TOKEN:
        logger.warning("Telegram sozlanmagan")
        return False
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
            return False

        sent_ok = False
        async with httpx.AsyncClient(timeout=2.0) as client:
            for chat_id, thread_id in targets:
                payload = {"chat_id": chat_id, "text": text}
                if thread_id:
                    payload["message_thread_id"] = int(thread_id)
                resp = await client.post(url, json=payload)
                if resp.status_code >= 400:
                    logger.error("Telegram yuborilmadi (%s): %s", resp.status_code, resp.text[:300])
                else:
                    sent_ok = True
        return sent_ok
    except Exception as e:
        logger.error("Telegram xabar xato: %s", e)
        return False


async def send_telegram_document(
    document_bytes: bytes, filename: str, caption: str = "", section: str = "reports"
) -> list[dict]:
    """Hujjatni Telegram'ga yuboradi. Har bir yuborilgan xabar uchun
    {"chat_id":.., "message_id":..} qaytaradi — keyin shu xabarni
    o'chirib, yangisini yuborish (hisobotni yangilash) uchun kerak."""
    yuborilganlar: list[dict] = []
    chat_ids = _target_chat_ids()
    if not settings.BOT_TOKEN:
        logger.warning("Telegram sozlanmagan")
        return yuborilganlar
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
            return yuborilganlar

        async with httpx.AsyncClient(timeout=30.0) as client:
            for chat_id, thread_id in targets:
                data = {"chat_id": chat_id, "caption": caption[:1024]}
                if thread_id:
                    data["message_thread_id"] = str(thread_id)
                files = {"document": (filename, document_bytes, "application/pdf")}
                resp = await client.post(url, data=data, files=files)
                if resp.status_code >= 400:
                    logger.error("Telegram document yuborilmadi (%s): %s", resp.status_code, resp.text[:300])
                else:
                    try:
                        mid = resp.json()["result"]["message_id"]
                        yuborilganlar.append({"chat_id": chat_id, "message_id": mid})
                    except Exception:
                        pass
    except Exception as e:
        logger.error("Telegram document xato: %s", e)
    return yuborilganlar


async def delete_telegram_message(chat_id: str, message_id: int) -> None:
    """Avval yuborilgan xabarni o'chiradi (hisobot yangilanganda eskisini
    olib tashlash uchun). Xabar allaqachon o'chirilgan yoki 48 soatdan
    o'tib ketgan bo'lsa ham — bu jim xato, yangi xabar baribir yuboriladi."""
    if not settings.BOT_TOKEN:
        return
    url = f"https://api.telegram.org/bot{settings.BOT_TOKEN}/deleteMessage"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(url, json={"chat_id": chat_id, "message_id": message_id})
    except Exception as e:
        logger.warning("Telegram xabarni o'chirish xato: %s", e)


def send_telegram_background(text: str, section: str = "system") -> None:
    """Telegram xabarini darhol va to'g'ridan-to'g'ri yuboradi.
    Vercel Serverless konteyneri background threadlarni javob berilishi bilan
    o'ldirgani sababli, httpx.Client 3.0s timeout bilan to'g'ridan-to'g'ri ishlatiladi.
    """
    if not settings.BOT_TOKEN:
        return
    url = f"https://api.telegram.org/bot{settings.BOT_TOKEN}/sendMessage"
    chat_ids = _target_chat_ids()
    topic_key = TOPIC_MAP.get(section)
    topic_id = getattr(settings, topic_key, None) if topic_key else None
    targets: list[tuple[str, int | None]] = []
    parsed_topic = int(topic_id) if str(topic_id).strip().isdigit() else None
    for cid in chat_ids:
        targets.append((cid, parsed_topic))
    for linked in resolve_targets(section):
        if linked not in targets:
            targets.append(linked)
    if not targets:
        return

    try:
        with httpx.Client(timeout=3.0) as client:
            for chat_id, thread_id in targets:
                payload = {"chat_id": chat_id, "text": text}
                if thread_id:
                    payload["message_thread_id"] = int(thread_id)
                resp = client.post(url, json=payload)
                if resp.status_code >= 400:
                    logger.error("Telegram (direct) yuborilmadi (%s): %s", resp.status_code, resp.text[:300])
    except Exception as e:
        logger.error("Telegram direct notify error: %s", e)


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
