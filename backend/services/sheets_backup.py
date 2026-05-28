import json
import logging
from datetime import date, datetime
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy.orm import Session

from models.patient import Patient
from models.provider import Provider
from models.referrer import Referrer
from models.service import Service
from models.user import User
from services.finance import process_payment

_CFG_FILE = Path(__file__).resolve().parent.parent / "sheets_backup_config.json"
logger = logging.getLogger(__name__)


def load_backup_config() -> dict:
    if not _CFG_FILE.exists():
        return {"url": "", "enabled": False, "token": "", "last_sync_at": ""}
    try:
        data = json.loads(_CFG_FILE.read_text(encoding="utf-8"))
        return {
            "url": str(data.get("url", "")),
            "enabled": bool(data.get("enabled", False)),
            "token": str(data.get("token", "")),
            "last_sync_at": str(data.get("last_sync_at", "")),
        }
    except Exception:
        return {"url": "", "enabled": False, "token": "", "last_sync_at": ""}


def save_backup_config(cfg: dict) -> None:
    _CFG_FILE.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")


def _parse_date(v: Any) -> date:
    if isinstance(v, date):
        return v
    s = str(v or "").strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError("birth_date noto'g'ri")


def _parse_datetime(v: Any) -> datetime:
    s = str(v or "").strip()
    if not s:
        return datetime.utcnow()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%d.%m.%Y %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return datetime.utcnow()


def _payment_type(v: Any) -> str:
    s = str(v or "").strip().lower()
    if s in ("cash", "naqt", "naqd"):
        return "cash"
    return "card"


def _normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "first_name": str(row.get("first_name") or row.get("ism") or "").strip(),
        "last_name": str(row.get("last_name") or row.get("familiya") or "").strip(),
        "birth_date": _parse_date(row.get("birth_date") or row.get("tugilgan_sana") or row.get("birth")),
        "phone": str(row.get("phone") or row.get("telefon") or "").strip(),
        "address": str(row.get("address") or row.get("manzil") or "").strip() or "—",
        "service_name": str(row.get("service_name") or row.get("xizmat") or "").strip(),
        "provider_name": str(row.get("provider_name") or row.get("shifokor") or "").strip(),
        "referrer_name": str(row.get("referrer_name") or row.get("yonaltiruvchi") or "").strip(),
        "payment_amount": int(row.get("payment_amount") or row.get("summa") or 0),
        "payment_type": _payment_type(row.get("payment_type") or row.get("tolov_turi")),
        "created_at": _parse_datetime(row.get("created_at") or row.get("sana_vaqt") or row.get("created")),
    }


def _resolve_fk_ids(db: Session, row: dict[str, Any]) -> tuple[int | None, int | None, int | None]:
    service = (
        db.query(Service)
        .filter(Service.name.ilike(row["service_name"]), Service.is_active == True)
        .first()
    )
    provider = (
        db.query(Provider)
        .filter(Provider.full_name.ilike(row["provider_name"]), Provider.is_active == True)
        .first()
    )
    referrer = None
    if row["referrer_name"]:
        referrer = (
            db.query(Referrer)
            .filter(Referrer.full_name.ilike(row["referrer_name"]), Referrer.is_active == True)
            .first()
        )
    return referrer.id if referrer else None, provider.id if provider else None, service.id if service else None


def _creator_user_id(db: Session) -> int:
    u = db.query(User).filter(User.role == "ceo", User.is_active == True).first()
    if not u:
        u = db.query(User).filter(User.is_active == True).first()
    if not u:
        raise ValueError("Faol foydalanuvchi topilmadi")
    return u.id


def _already_exists(db: Session, row: dict[str, Any], provider_id: int, service_id: int) -> bool:
    q = (
        db.query(Patient)
        .filter(
            Patient.phone == row["phone"],
            Patient.birth_date == row["birth_date"],
            Patient.provider_id == provider_id,
            Patient.service_id == service_id,
            Patient.payment_amount == row["payment_amount"],
            Patient.is_cancelled == False,
        )
        .first()
    )
    return q is not None


def import_rows_to_db(db: Session, rows: list[dict[str, Any]]) -> dict:
    inserted = 0
    exists = 0
    skipped = 0
    errors: list[str] = []
    creator_id = _creator_user_id(db)
    for idx, raw in enumerate(rows, start=1):
        try:
            row = _normalize_row(raw)
            if not row["first_name"] or not row["last_name"] or not row["phone"]:
                skipped += 1
                continue
            referrer_id, provider_id, service_id = _resolve_fk_ids(db, row)
            if not provider_id or not service_id:
                skipped += 1
                errors.append(f"#{idx}: provider/service topilmadi")
                continue
            if _already_exists(db, row, provider_id, service_id):
                exists += 1
                continue
            p = Patient(
                first_name=row["first_name"],
                last_name=row["last_name"],
                birth_date=row["birth_date"],
                phone=row["phone"],
                address=row["address"],
                referrer_id=referrer_id,
                provider_id=provider_id,
                service_id=service_id,
                payment_amount=row["payment_amount"],
                payment_type=row["payment_type"],
                created_at=row["created_at"],
                created_by=creator_id,
            )
            db.add(p)
            db.flush()
            process_payment(db, p)
            inserted += 1
        except Exception as e:
            skipped += 1
            errors.append(f"#{idx}: {e}")
    db.commit()
    return {"inserted": inserted, "exists": exists, "skipped": skipped, "errors": errors[:30]}


def fetch_rows_from_backup_url(url: str, token: str = "") -> list[dict[str, Any]]:
    headers = {"Accept": "application/json"}
    params: dict[str, str] = {}
    if token:
        headers["X-Backup-Token"] = token
        params["token"] = token
    with httpx.Client(timeout=20.0, follow_redirects=True) as client:
        res = client.get(url, headers=headers, params=params)
        res.raise_for_status()
        try:
            data = res.json()
        except Exception as e:
            logger.error("Backup URL JSON emas: %s", res.text[:300])
            raise ValueError("Backup URL JSON qaytarmadi") from e
    if isinstance(data, dict) and "rows" in data and isinstance(data["rows"], list):
        return data["rows"]
    if isinstance(data, list):
        return data
    return []


def push_row_to_backup_url(row: dict[str, Any]) -> bool:
    cfg = load_backup_config()
    if not cfg.get("url"):
        return False
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    params: dict[str, str] = {}
    if cfg.get("token"):
        headers["X-Backup-Token"] = cfg["token"]
        params["token"] = cfg["token"]
    try:
        payload_row: dict[str, Any] = {}
        for k, v in row.items():
            if isinstance(v, (datetime, date)):
                payload_row[k] = v.isoformat()
            else:
                payload_row[k] = v
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            res = client.post(cfg["url"], json={"rows": [payload_row]}, headers=headers, params=params)
            if res.status_code >= 400:
                logger.error("Backup URL push xato (%s): %s", res.status_code, res.text[:300])
                return False
            try:
                body = res.json()
                if isinstance(body, dict) and body.get("ok") is False:
                    logger.error("Backup URL push rad etildi: %s", body.get("error") or body)
                    return False
            except Exception:
                # Ba'zi scriptlar JSON qaytarmasligi mumkin, status=200 bo'lsa davom etamiz.
                pass
            logger.info("Backup URL push muvaffaqiyatli: %s", res.status_code)
        return True
    except Exception as e:
        logger.error("Backup URL push exception: %s", e)
        return False


def sync_from_configured_url(db: Session) -> dict:
    cfg = load_backup_config()
    if not cfg.get("enabled") or not cfg.get("url"):
        return {"inserted": 0, "exists": 0, "skipped": 0, "errors": ["URL ulanmagan yoki o'chirilgan"]}
    rows = fetch_rows_from_backup_url(cfg["url"], cfg.get("token", ""))
    result = import_rows_to_db(db, rows)
    cfg["last_sync_at"] = datetime.utcnow().isoformat()
    save_backup_config(cfg)
    return result
