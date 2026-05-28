from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session

from auth_utils import require_ceo
from database import get_db
from models.user import User
from services.sheets_backup import (
    fetch_rows_from_backup_url,
    load_backup_config,
    save_backup_config,
    sync_from_configured_url,
)

router = APIRouter(prefix="/api/sheets-backup", tags=["sheets-backup"])


class BackupConfigBody(BaseModel):
    url: HttpUrl
    enabled: bool = True
    token: str = ""


@router.get("/config")
def get_config(_: User = Depends(require_ceo)):
    return load_backup_config()


@router.post("/config")
def set_config(body: BackupConfigBody, _: User = Depends(require_ceo)):
    cfg = load_backup_config()
    cfg["url"] = str(body.url)
    cfg["enabled"] = body.enabled
    cfg["token"] = body.token.strip()
    save_backup_config(cfg)
    return cfg


@router.post("/test")
def test_connection(_: User = Depends(require_ceo)):
    cfg = load_backup_config()
    if not cfg.get("url"):
        raise HTTPException(status_code=400, detail="URL kiritilmagan")
    rows = fetch_rows_from_backup_url(cfg["url"], cfg.get("token", ""))
    return {"ok": True, "rows_found": len(rows)}


@router.post("/sync")
def sync_now(db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    return sync_from_configured_url(db)
