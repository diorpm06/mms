import json
import logging
import queue
import threading
from datetime import datetime
from typing import Any

try:
    import gspread
    from google.oauth2.service_account import Credentials
    _GSPREAD_AVAILABLE = True
except ImportError:
    _GSPREAD_AVAILABLE = False

from config import settings

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

_sheet_queue: queue.Queue = queue.Queue()
_worker_started = False


def _get_client():
    if not _GSPREAD_AVAILABLE:
        raise RuntimeError("gspread o'rnatilmagan")
    creds = Credentials.from_service_account_file(
        settings.GOOGLE_SHEETS_CREDENTIALS, scopes=SCOPES
    )
    return gspread.authorize(creds)


def _get_or_create_worksheet(client, sheet_name: str, header_row: list[str]):
    """Berilgan nomdagi varaqni ochadi; topilmasa yaratadi va sarlavha
    qatorini yozadi. Zahida (hisobchi) uchun bitta jadvalda bir nechta
    varaq (Bemorlar, Xarajatlar, Chiqarilgan Pul) bo'lishi kerak edi —
    varaqlar avtomatik yaratilmasa, har safar qo'lda tuzish kerak bo'lardi."""
    doc = client.open_by_key(settings.SPREADSHEET_ID)
    try:
        return doc.worksheet(sheet_name)
    except gspread.WorksheetNotFound:
        ws = doc.add_worksheet(title=sheet_name, rows=1000, cols=max(10, len(header_row)))
        ws.append_row(header_row, value_input_option="USER_ENTERED")
        return ws


def _append_row(patient_data: dict[str, Any]) -> None:
    if not settings.SPREADSHEET_ID:
        logger.warning("SPREADSHEET_ID sozlanmagan")
        return
    client = _get_client()
    sheet = client.open_by_key(settings.SPREADSHEET_ID).sheet1
    created = patient_data.get("created_at")
    if isinstance(created, datetime):
        date_str = created.strftime("%d.%m.%Y")
        time_str = created.strftime("%H:%M")
    else:
        date_str = datetime.now().strftime("%d.%m.%Y")
        time_str = datetime.now().strftime("%H:%M")

    row = [
        patient_data.get("row_num", ""),
        date_str,
        time_str,
        patient_data.get("first_name", ""),
        patient_data.get("last_name", ""),
        patient_data.get("birth_date", ""),
        patient_data.get("phone", ""),
        patient_data.get("address", ""),
        patient_data.get("referrer_name", "—"),
        patient_data.get("provider_name", ""),
        patient_data.get("service_name", ""),
        patient_data.get("payment_amount", 0),
        "Naqt" if patient_data.get("payment_type") == "cash" else "Karta",
    ]
    sheet.append_row(row, value_input_option="USER_ENTERED")


def add_patient_to_sheets(patient_data: dict[str, Any], retries: int = 3) -> bool:
    last_error = None
    for attempt in range(retries):
        try:
            _append_row(patient_data)
            return True
        except Exception as e:
            last_error = e
            logger.error("Sheets xato (urinish %s): %s", attempt + 1, e)
    logger.error("Sheets ga yuborish muvaffaqiyatsiz: %s", last_error)
    _sheet_queue.put(patient_data)
    return False


EXPENSE_HEADERS = ["Sana", "Vaqt", "Kim kiritdi", "Bo'lim (Kategoriya)", "Izoh", "Summa (so'm)"]


def _append_expense_row(expense_data: dict[str, Any]) -> None:
    if not settings.SPREADSHEET_ID:
        logger.warning("SPREADSHEET_ID sozlanmagan")
        return
    client = _get_client()
    sheet = _get_or_create_worksheet(client, "Xarajatlar", EXPENSE_HEADERS)
    created = expense_data.get("created_at")
    if isinstance(created, datetime):
        date_str = created.strftime("%d.%m.%Y")
        time_str = created.strftime("%H:%M")
    else:
        date_str = datetime.now().strftime("%d.%m.%Y")
        time_str = datetime.now().strftime("%H:%M")

    row = [
        date_str,
        time_str,
        expense_data.get("creator_name", ""),
        expense_data.get("category", "Boshqa"),
        expense_data.get("description", ""),
        expense_data.get("amount", 0),
    ]
    sheet.append_row(row, value_input_option="USER_ENTERED")


def add_expense_to_sheets(expense_data: dict[str, Any], retries: int = 3) -> bool:
    last_error = None
    for attempt in range(retries):
        try:
            _append_expense_row(expense_data)
            return True
        except Exception as e:
            last_error = e
            logger.error("Sheets xarajat xatosi (urinish %s): %s", attempt + 1, e)
    logger.error("Xarajatni Sheets ga yuborish muvaffaqiyatsiz: %s", last_error)
    return False


PAYOUT_HEADERS = ["Sana", "Vaqt", "Kimga", "Turi", "Summa (so'm)", "Manba"]


def _append_payout_row(payout_data: dict[str, Any]) -> None:
    if not settings.SPREADSHEET_ID:
        logger.warning("SPREADSHEET_ID sozlanmagan")
        return
    client = _get_client()
    sheet = _get_or_create_worksheet(client, "Chiqarilgan Pul", PAYOUT_HEADERS)
    created = payout_data.get("created_at")
    if isinstance(created, datetime):
        date_str = created.strftime("%d.%m.%Y")
        time_str = created.strftime("%H:%M")
    else:
        date_str = datetime.now().strftime("%d.%m.%Y")
        time_str = datetime.now().strftime("%H:%M")

    turi_map = {"provider": "Shifokor", "referrer": "Yo'naltiruvchi", "employee": "Xodim"}
    row = [
        date_str,
        time_str,
        payout_data.get("recipient_name", ""),
        turi_map.get(payout_data.get("recipient_type"), payout_data.get("recipient_type", "")),
        payout_data.get("amount", 0),
        payout_data.get("source", ""),
    ]
    sheet.append_row(row, value_input_option="USER_ENTERED")


def add_payout_to_sheets(payout_data: dict[str, Any], retries: int = 3) -> bool:
    last_error = None
    for attempt in range(retries):
        try:
            _append_payout_row(payout_data)
            return True
        except Exception as e:
            last_error = e
            logger.error("Sheets payout xatosi (urinish %s): %s", attempt + 1, e)
    logger.error("Payoutni Sheets ga yuborish muvaffaqiyatsiz: %s", last_error)
    return False


def _queue_worker():
    while True:
        data = _sheet_queue.get()
        if data is None:
            break
        if add_patient_to_sheets(data, retries=3):
            logger.info("Queue dan muvaffaqiyatli yuborildi")
        _sheet_queue.task_done()


def start_sheet_worker():
    global _worker_started
    if _worker_started:
        return
    t = threading.Thread(target=_queue_worker, daemon=True)
    t.start()
    _worker_started = True


def process_webhook_payload(payload: dict) -> dict:
    """Apps Script dan kelgan webhook ma'lumotini qayta ishlaydi."""
    logger.info("Sheets webhook: %s", json.dumps(payload, ensure_ascii=False)[:500])
    return {"status": "received", "rows": payload.get("rows", [])}
