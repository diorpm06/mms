import json
from pathlib import Path

SECTIONS = {
    "registratsiya": "registration",
    "yotganlar": "inpatients",
    "moliya": "finance",
    "hisobotlar": "reports",
    "bekor": "cancellations",
    "tizim": "system",
}

_FILE = Path(__file__).resolve().parent.parent / "telegram_links.json"


def _default_data() -> dict:
    return {v: [] for v in SECTIONS.values()}


def load_links() -> dict:
    if not _FILE.exists():
        return _default_data()
    try:
        data = json.loads(_FILE.read_text(encoding="utf-8"))
        for k in _default_data():
            data.setdefault(k, [])
        return data
    except Exception:
        return _default_data()


def save_links(data: dict) -> None:
    _FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def add_link(section: str, chat_id: int | str, thread_id: int | None) -> None:
    data = load_links()
    sec = data.setdefault(section, [])
    target = {"chat_id": str(chat_id), "thread_id": thread_id}
    if target not in sec:
        sec.append(target)
    save_links(data)


def remove_link(section: str, chat_id: int | str, thread_id: int | None) -> bool:
    data = load_links()
    sec = data.setdefault(section, [])
    before = len(sec)
    sec[:] = [x for x in sec if not (x.get("chat_id") == str(chat_id) and x.get("thread_id") == thread_id)]
    save_links(data)
    return len(sec) < before


def list_links_text() -> str:
    data = load_links()
    lines = ["🔗 Ulangan guruh/topiclar:"]
    for uz, key in SECTIONS.items():
        vals = data.get(key, [])
        if not vals:
            lines.append(f"- {uz}: yo'q")
            continue
        parts = [f"{v['chat_id']}#{v.get('thread_id') or '-'}" for v in vals]
        lines.append(f"- {uz}: {', '.join(parts)}")
    return "\n".join(lines)


def resolve_targets(section: str) -> list[tuple[str, int | None]]:
    data = load_links()
    out: list[tuple[str, int | None]] = []
    for item in data.get(section, []):
        out.append((str(item.get("chat_id")), item.get("thread_id")))
    return out
