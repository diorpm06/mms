import json
from datetime import datetime
from pathlib import Path

_FILE = Path(__file__).resolve().parent.parent / "salary_reminder.json"


def load_salary_reminder() -> dict:
    if not _FILE.exists():
        return {
            "enabled": False,
            "time": "09:00",
            "day_of_month": 1,
            "month": 0,
            "last_sent_date": "",
        }
    try:
        data = json.loads(_FILE.read_text(encoding="utf-8"))
        return {
            "enabled": bool(data.get("enabled", False)),
            "time": str(data.get("time", "09:00")),
            "day_of_month": int(data.get("day_of_month", 1)),
            "month": int(data.get("month", 0)),
            "last_sent_date": str(data.get("last_sent_date", "")),
        }
    except Exception:
        return {
            "enabled": False,
            "time": "09:00",
            "day_of_month": 1,
            "month": 0,
            "last_sent_date": "",
        }


def save_salary_reminder(data: dict) -> None:
    _FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def should_send_now(now: datetime | None = None) -> bool:
    current = now or datetime.now()
    cfg = load_salary_reminder()
    if not cfg.get("enabled"):
        return False
    hhmm = cfg.get("time", "09:00")
    if len(hhmm) != 5 or hhmm[2] != ":":
        return False
    if current.strftime("%H:%M") != hhmm:
        return False
    day_of_month = int(cfg.get("day_of_month", 1))
    if current.day != day_of_month:
        return False
    month = int(cfg.get("month", 0))
    if month and current.month != month:
        return False
    if cfg.get("last_sent_date") == current.strftime("%Y-%m-%d"):
        return False
    return True

