from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models.chat import ChatMessage
from models.user import User
from auth_utils import get_current_user

router = APIRouter(prefix="/api/chat", tags=["chat"])


class SendMessageBody(BaseModel):
    recipient_id: int | None = None
    content: str


@router.get("/messages")
def get_messages(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    messages = (
        db.query(ChatMessage)
        .order_by(ChatMessage.created_at.asc())
        .limit(100)
        .all()
    )
    
    # Mark messages as read for this user if applicable
    db.query(ChatMessage).filter(
        ChatMessage.recipient_id == current_user.id,
        ChatMessage.is_read == False
    ).update({"is_read": True})
    db.commit()

    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_name": m.sender.full_name if m.sender else "Xodim",
            "sender_role": m.sender.role if m.sender else "admin",
            "recipient_id": m.recipient_id,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
            "is_read": m.is_read,
        }
        for m in messages
    ]


@router.post("/send")
def send_message(
    body: SendMessageBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=400, detail="Xabar matni bo'sh bo'lishi mumkin emas")

    msg = ChatMessage(
        sender_id=current_user.id,
        recipient_id=body.recipient_id,
        content=body.content.strip(),
        is_read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": current_user.full_name,
        "sender_role": current_user.role,
        "recipient_id": msg.recipient_id,
        "content": msg.content,
        "created_at": msg.created_at.isoformat(),
        "is_read": msg.is_read,
    }


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    count = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.sender_id != current_user.id,
            ChatMessage.is_read == False,
        )
        .count()
    )
    return {"unread": count}
