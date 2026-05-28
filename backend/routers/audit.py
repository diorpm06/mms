from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from auth_utils import require_ceo
from database import get_db
from models.audit_log import AuditLog
from models.user import User

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/logs")
def list_audit_logs(
    user_id: int | None = None,
    action_type: str | None = None,
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    limit: int = 200,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if action_type:
        q = q.filter(AuditLog.action_type == action_type)
    if from_date:
        q = q.filter(AuditLog.created_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        q = q.filter(AuditLog.created_at <= datetime.combine(to_date, datetime.max.time()))
    logs = q.limit(limit).all()
    users = {u.id: u.full_name for u in db.query(User).all()}
    return [
        {
            "id": l.id,
            "created_at": l.created_at.isoformat(),
            "user_id": l.user_id,
            "user_name": users.get(l.user_id, "Tizim"),
            "user_role": l.user_role,
            "action_type": l.action_type,
            "table_name": l.table_name,
            "record_id": l.record_id,
            "old_data": l.old_data,
            "new_data": l.new_data,
            "reason": l.reason,
            "ip_address": l.ip_address,
            "detail": l.new_data or l.old_data,
        }
        for l in logs
    ]


@router.get("/sessions")
def list_sessions(
    user_id: int | None = None,
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo),
):
    from models.session_log import SessionLog

    q = db.query(SessionLog).order_by(SessionLog.login_at.desc())
    if user_id:
        q = q.filter(SessionLog.user_id == user_id)
    if from_date:
        q = q.filter(SessionLog.login_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        q = q.filter(SessionLog.login_at <= datetime.combine(to_date, datetime.max.time()))
    sessions = q.limit(200).all()
    users = {u.id: u.full_name for u in db.query(User).all()}
    return [
        {
            "id": s.id,
            "user_name": users.get(s.user_id, "?"),
            "login_at": s.login_at.isoformat(),
            "logout_at": s.logout_at.isoformat() if s.logout_at else None,
            "ip_address": s.ip_address,
            "duration_seconds": s.duration_seconds,
            "duration_label": _format_duration(s.duration_seconds),
        }
        for s in sessions
    ]


def _format_duration(seconds: int | None) -> str:
    if not seconds:
        return "—"
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    parts = []
    if h:
        parts.append(f"{h}s")
    if m:
        parts.append(f"{m}d")
    if s or not parts:
        parts.append(f"{s}s")
    return " ".join(parts)
