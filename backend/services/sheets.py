import json
import logging
import queue
import threading
from datetime import datetime
from typing import Any

import gspread
from google.oauth2.service_account import Credentials

from config import settings

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

_sheet_queue: queue.Queue = queue.Queue()
_worker_started = False


def _get_client():
    creds = Credentials.from_service_account_file(
        settings.GOOGLE_SHEETS_CREDENTIALS, scopes=SCOPES
    )
    return gspread.authorize(creds)


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
        date_str = datetime.utcnow().strftime("%d.%m.%Y")
        time_str = datetime.utcnow().strftime("%H:%M")

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
