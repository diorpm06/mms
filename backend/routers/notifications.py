from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth_utils import get_current_user
from database import get_db
from models.audit_log import AuditLog
from models.user import User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

ACTION_LABELS = {
    "LOGIN":     "Tizimga kirdi",
    "LOGOUT":    "Tizimdan chiqdi",
    "CREATE":    "Yangi yozuv qo'shildi",
    "UPDATE":    "Ma'lumot yangilandi",
    "CANCEL":    "Bekor qilindi",
    "PAYMENT":   "To'lov qilindi",
    "EXPENSE":   "Harajat kiritildi",
    "SALARY":    "Maosh to'landi",
    "ADVANCE":   "Avans berildi",
    "DISCHARGE": "Bemor chiqarildi",
    "ADMIT":     "Bemor yotqizildi",
    "REPORT_SUBMITTED": "Shablon chop etishga yuborildi",
}

ACTION_ICONS = {
    "LOGIN":     "🔐",
    "LOGOUT":    "🚪",
    "CREATE":    "✅",
    "UPDATE":    "✏️",
    "CANCEL":    "❌",
    "PAYMENT":   "💰",
    "EXPENSE":   "💸",
    "SALARY":    "💼",
    "ADVANCE":   "💵",
    "DISCHARGE": "🏥",
    "ADMIT":     "🛏️",
    "REPORT_SUBMITTED": "📋",
}


@router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.utcnow() - timedelta(hours=48)
    q = db.query(AuditLog).filter(AuditLog.created_at >= since)

    if current_user.role == "admin":
        # Admin o'z harakatlarini + hamma joydan kelgan shablon topshiriqlarini ko'radi
        from sqlalchemy import or_
        q = q.filter(or_(AuditLog.user_id == current_user.id, AuditLog.action_type == "REPORT_SUBMITTED"))
    elif current_user.role != "ceo":
        q = q.filter(AuditLog.user_id == current_user.id)

    logs = q.order_by(AuditLog.created_at.desc()).limit(30).all()
    users = {u.id: u.full_name for u in db.query(User).all()}

    result = []
    for log in logs:
        message = log.old_data or ACTION_LABELS.get(log.action_type, log.action_type)
        result.append({
            "id": log.id,
            "created_at": log.created_at.isoformat(),
            "user_name": users.get(log.user_id, "Tizim"),
            "action_type": log.action_type,
            "icon": ACTION_ICONS.get(log.action_type, "📌"),
            "message": message,
        })

    return result
