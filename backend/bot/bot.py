import asyncio
import logging
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from aiogram import BaseMiddleware, Bot, Dispatcher, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import KeyboardButton, Message, ReplyKeyboardMarkup, TelegramObject

from config import settings
from database import SessionLocal
from services.finance import get_or_create_balance
from services.reports_data import daily_report, get_report, monthly_report, weekly_report
from services.telegram_links import SECTIONS, add_link, list_links_text, remove_link
from services.telegram_notify import _format_report_message

logging.basicConfig(level=logging.INFO)
bot = Bot(token=settings.BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())


def _allowed_chat_ids() -> set[str]:
    ids = set()
    for raw in (settings.CEO_CHAT_ID, settings.TELEGRAM_CHAT_ID):
        if raw and str(raw).strip():
            ids.add(str(raw).strip())
    for cid in (settings.TELEGRAM_CHAT_IDS or "").split(","):
        cid = cid.strip()
        if cid:
            ids.add(cid)
    return ids


class _AuthMiddleware(BaseMiddleware):
    """DIQQAT: ilgari BOT'ning HECH BIR komandasida ruxsat tekshiruvi
    yo'q edi — botni topgan istalgan kishi /kunlik, /balans, /oylik
    kabi komandalar bilan klinikaning to'liq moliyaviy hisobotini
    o'qiy olardi, ustiga ustak /ulash orqali O'Z guruhini doimiy
    moliyaviy xabarlar oluvchi sifatida ro'yxatdan o'tkazib qo'ya
    olardi (kelajakdagi barcha hisobotlar unga ham ketaverardi).
    /start va /yordam — bot nima ekanini tushuntiradi, xavfsiz,
    hammaga ochiq qoladi."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: Message,
        data: Dict[str, Any],
    ) -> Any:
        text = (event.text or "").strip().lower()
        if text.startswith("/start") or text.startswith("/yordam") or text == "❓ yordam":
            return await handler(event, data)

        allowed = _allowed_chat_ids()
        if not allowed:
            logging.warning(
                "Telegram bot: CEO_CHAT_ID/TELEGRAM_CHAT_ID(S) sozlanmagan — "
                "hech kimga (hatto CEO'ga ham) komandalarga ruxsat berilmaydi."
            )
            await event.answer("⛔ Bot hali sozlanmagan (ruxsat berilgan chat yo'q).")
            return None

        if str(event.chat.id) in allowed:
            return await handler(event, data)

        await event.answer("⛔ Sizga bu botdan foydalanishga ruxsat berilmagan.")
        return None


dp.message.outer_middleware(_AuthMiddleware())


class DateRange(StatesGroup):
    start = State()
    end = State()


MAIN_KB = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="📊 Kunlik"), KeyboardButton(text="📅 Haftalik")],
        [KeyboardButton(text="🗓 Oylik"), KeyboardButton(text="💼 Balans")],
        [KeyboardButton(text="🧮 Muddatli"), KeyboardButton(text="🔗 Guruhga ulash")],
        [KeyboardButton(text="📋 Ulanganlar"), KeyboardButton(text="❓ Yordam")],
    ],
    resize_keyboard=True,
)


def _db_report(fn):
    db = SessionLocal()
    try:
        return fn(db)
    finally:
        db.close()


@dp.message(Command("start"))
async def cmd_start(message: Message):
    await message.answer(
        "🏥 Marjona Med Service botiga xush kelibsiz!\n\n"
        "/kunlik — bugungi hisobot\n"
        "/haftalik — haftalik hisobot\n"
        "/oylik — oylik hisobot\n"
        "/balans — joriy balans\n"
        "/muddat — muddatli hisobot\n"
        "/ulash <bolim> — shu guruh/topicni ulash\n"
        "/uzish <bolim> — shu guruh/topicni uzish\n"
        "/boglangan — ulanganlar ro'yxati\n"
        "/yordam — yordam",
        reply_markup=MAIN_KB,
    )


@dp.message(Command("yordam"))
async def cmd_help(message: Message):
    await cmd_start(message)


@dp.message(Command("boglangan"))
async def cmd_links(message: Message):
    await message.answer(list_links_text(), reply_markup=MAIN_KB)


@dp.message(Command("ulash"))
async def cmd_link(message: Message):
    parts = (message.text or "").split()
    if len(parts) < 2:
        await message.answer("Foydalanish: /ulash registratsiya|yotganlar|moliya|hisobotlar|bekor|tizim")
        return
    sec_uz = parts[1].strip().lower()
    section = SECTIONS.get(sec_uz)
    if not section:
        await message.answer("Noto'g'ri bo'lim. Variant: registratsiya, yotganlar, moliya, hisobotlar, bekor, tizim")
        return
    thread_id = getattr(message, "message_thread_id", None)
    add_link(section, message.chat.id, thread_id)
    await message.answer(f"✅ Ulandi: {sec_uz} -> chat {message.chat.id}, topic {thread_id or '-'}")


@dp.message(Command("uzish"))
async def cmd_unlink(message: Message):
    parts = (message.text or "").split()
    if len(parts) < 2:
        await message.answer("Foydalanish: /uzish registratsiya|yotganlar|moliya|hisobotlar|bekor|tizim")
        return
    sec_uz = parts[1].strip().lower()
    section = SECTIONS.get(sec_uz)
    if not section:
        await message.answer("Noto'g'ri bo'lim.")
        return
    thread_id = getattr(message, "message_thread_id", None)
    removed = remove_link(section, message.chat.id, thread_id)
    await message.answer("🗑 Ulanish olib tashlandi" if removed else "Topilmadi")


@dp.message(Command("kunlik"))
async def cmd_daily(message: Message):
    report = _db_report(lambda db: daily_report(db, date.today()))
    await message.answer(_format_report_message(report, "KUNLIK HISOBOT"))


@dp.message(Command("haftalik"))
async def cmd_weekly(message: Message):
    report = _db_report(lambda db: weekly_report(db, date.today()))
    await message.answer(_format_report_message(report, "HAFTALIK HISOBOT"))


@dp.message(Command("oylik"))
async def cmd_monthly(message: Message):
    d = date.today()
    report = _db_report(lambda db: monthly_report(db, d.year, d.month))
    await message.answer(_format_report_message(report, "OYLIK HISOBOT"))


@dp.message(Command("balans"))
async def cmd_balance(message: Message):
    def _bal(db):
        bal = get_or_create_balance(db)
        return bal.current_balance

    amount = _db_report(_bal)
    await message.answer(f"💼 Joriy balans: {amount:,} so'm".replace(",", " "))


@dp.message(Command("muddat"))
async def cmd_period(message: Message, state: FSMContext):
    await state.set_state(DateRange.start)
    await message.answer("📅 Boshlang'ich sanani kiriting (DD.MM.YYYY):")


@dp.message(F.text == "📊 Kunlik")
async def kb_daily(message: Message):
    await cmd_daily(message)


@dp.message(F.text == "📅 Haftalik")
async def kb_weekly(message: Message):
    await cmd_weekly(message)


@dp.message(F.text == "🗓 Oylik")
async def kb_monthly(message: Message):
    await cmd_monthly(message)


@dp.message(F.text == "💼 Balans")
async def kb_balance(message: Message):
    await cmd_balance(message)


@dp.message(F.text == "🧮 Muddatli")
async def kb_period(message: Message, state: FSMContext):
    await cmd_period(message, state)


@dp.message(F.text == "📋 Ulanganlar")
async def kb_links(message: Message):
    await cmd_links(message)


@dp.message(F.text == "❓ Yordam")
async def kb_help(message: Message):
    await cmd_help(message)


@dp.message(F.text == "🔗 Guruhga ulash")
async def kb_link_help(message: Message):
    await message.answer(
        "Guruh/topicga ulash uchun o'sha guruh (yoki forum bo'lim) ichida komanda bering:\n"
        "/ulash registratsiya\n"
        "/ulash yotganlar\n"
        "/ulash moliya\n"
        "/ulash hisobotlar\n"
        "/ulash bekor\n"
        "/ulash tizim\n\n"
        "Uzish: /uzish <bolim>",
        reply_markup=MAIN_KB,
    )


@dp.message(DateRange.start)
async def period_start(message: Message, state: FSMContext):
    try:
        d = datetime.strptime(message.text.strip(), "%d.%m.%Y").date()
    except ValueError:
        await message.answer("❌ Noto'g'ri format. DD.MM.YYYY kiriting:")
        return
    await state.update_data(start=d.isoformat())
    await state.set_state(DateRange.end)
    await message.answer("📅 Tugash sanasini kiriting (DD.MM.YYYY):")


@dp.message(DateRange.end)
async def period_end(message: Message, state: FSMContext):
    try:
        end = datetime.strptime(message.text.strip(), "%d.%m.%Y").date()
    except ValueError:
        await message.answer("❌ Noto'g'ri format. DD.MM.YYYY kiriting:")
        return
    data = await state.get_data()
    start = date.fromisoformat(data["start"])
    report = _db_report(lambda db: get_report(db, start, end))
    await state.clear()
    await message.answer(_format_report_message(report, "MUDDATLI HISOBOT"))


async def main():
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
