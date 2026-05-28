import json
from typing import Any, Optional

from fastapi import Request
from sqlalchemy.orm import Session

from models.audit_log import AuditLog


def _serialize(data: Any) -> str | None:
    if data is None:
        return None
    if isinstance(data, str):
        return data
    return json.dumps(data, ensure_ascii=False, default=str)


def get_client_info(request: Request | None) -> tuple[str | None, str | None]:
    if not request:
        return None, None
    ip = request.client.host if request.client else None
    device = request.headers.get("user-agent", "")[:255]
    return ip, device


def log_audit(
    db: Session,
    *,
    user_id: int | None,
    user_role: str,
    action_type: str,
    table_name: str,
    record_id: int | None = None,
    old_data: Any = None,
    new_data: Any = None,
    reason: str | None = None,
    ip_address: str | None = None,
    device_info: str | None = None,
    detail_message: str | None = None,
) -> AuditLog:
    """Audit log yozadi — faqat INSERT."""
    entry = AuditLog(
        user_id=user_id,
        user_role=user_role,
        action_type=action_type,
        table_name=table_name,
        record_id=record_id,
        old_data=_serialize(old_data) if old_data is not None else detail_message,
        new_data=_serialize(new_data),
        reason=reason,
        ip_address=ip_address,
        device_info=device_info,
    )
    db.add(entry)
    db.flush()
    return entry
