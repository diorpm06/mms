from fastapi import APIRouter, Header, HTTPException

from config import settings
from database import SessionLocal
from services.sheets_backup import import_rows_to_db

router = APIRouter(prefix="/api/webhook", tags=["webhook"])


@router.post("/sheets")
async def sheets_webhook(payload: dict, x_webhook_secret: str | None = Header(None)):
    if not settings.SHEETS_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook sozlanmagan (SHEETS_WEBHOOK_SECRET yo'q)")
    if x_webhook_secret != settings.SHEETS_WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Webhook secret noto'g'ri")
    rows = payload.get("rows") if isinstance(payload, dict) else []
    if not isinstance(rows, list):
        rows = []
    db = SessionLocal()
    try:
        return import_rows_to_db(db, rows)
    finally:
        db.close()
