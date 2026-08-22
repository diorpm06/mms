from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session, joinedload

from auth_utils import get_current_user
from database import get_db
from models.chat import ChatMessage
from models.provider import Provider
from models.user import User

router = APIRouter(prefix="/api/chat", tags=["chat"])


class SendMessageBody(BaseModel):
    recipient_id: Optional[int] = None
    content: str


@router.get("/channels")
def get_chat_channels(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Telegram kabi barcha chat kanallari va xodimlar ro'yxatini qaytaradi."""
    channels = []

    # 1. Umumiy Guruh (Group Chat)
    last_group_msg = (
        db.query(ChatMessage)
        .filter(ChatMessage.recipient_id.is_(None))
        .order_by(ChatMessage.created_at.desc())
        .first()
    )

    unread_group_count = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.recipient_id.is_(None),
            ChatMessage.sender_id != current_user.id,
            ChatMessage.is_read == False,
        )
        .count()
    )

    channels.append({
        "id": "group",
        "name": "📢 Umumiy Guruh (Barcha Xodimlar)",
        "role": "group",
        "specialization": "Klinika umumiy chati",
        "unread_count": unread_group_count,
        "last_message": last_group_msg.content if last_group_msg else "Xabarlar yo'q",
        "last_time": last_group_msg.created_at.isoformat() if last_group_msg else None,
        "is_group": True,
    })

    # 2. Barcha boshqa xodimlar (Direct Chats: Doctor, Admin, CEO)
    other_users = (
        db.query(User)
        .options(joinedload(User.provider))
        .filter(User.is_active == True, User.id != current_user.id)
        .order_by(User.full_name.asc())
        .all()
    )

    # Ilgari bu yerda HAR BIR xodim uchun ikkita alohida so'rov ketardi:
    # oxirgi xabar va o'qilmaganlar soni. 10 ta xodimda 20 ta so'rov, va
    # bu ro'yxat chat ochiq turganda har 2.5 soniyada qayta so'raladi.
    #
    # Endi ikkalasi ham BITTA so'rovdan olinadi.

    # O'qilmaganlar — jo'natuvchi bo'yicha guruhlab
    oqilmaganlar = dict(
        db.query(ChatMessage.sender_id, func.count(ChatMessage.id))
        .filter(
            ChatMessage.recipient_id == current_user.id,
            ChatMessage.is_read == False,  # noqa: E712
        )
        .group_by(ChatMessage.sender_id)
        .all()
    )

    # Har bir suhbatdagi oxirgi xabar. "Suhbatdosh" — men jo'natgan bo'lsam
    # qabul qiluvchi, aks holda jo'natuvchi. MAX(id) oxirgisini beradi
    # (id o'sib boradi, shuning uchun vaqt bo'yicha ham oxirgisi).
    suhbatdosh = case(
        (ChatMessage.sender_id == current_user.id, ChatMessage.recipient_id),
        else_=ChatMessage.sender_id,
    )
    oxirgi_idlar = [
        r[1] for r in db.query(suhbatdosh, func.max(ChatMessage.id))
        .filter(
            ChatMessage.recipient_id.isnot(None),
            or_(
                ChatMessage.sender_id == current_user.id,
                ChatMessage.recipient_id == current_user.id,
            ),
        )
        .group_by(suhbatdosh)
        .all()
    ]
    oxirgi_xabarlar = {}
    if oxirgi_idlar:
        for m in db.query(ChatMessage).filter(
                ChatMessage.id.in_(oxirgi_idlar)).all():
            kim = m.recipient_id if m.sender_id == current_user.id else m.sender_id
            oxirgi_xabarlar[kim] = m

    for u in other_users:
        last_dm = oxirgi_xabarlar.get(u.id)
        unread_dm = int(oqilmaganlar.get(u.id, 0))

        spec = ""
        if u.role == "doctor" and u.provider:
            spec = u.provider.specialization or "Shifokor"
        elif u.role == "ceo":
            spec = "Klinika Rahbari (CEO)"
        elif u.role == "admin":
            spec = "Klinika Admin / Registratura"

        channels.append({
            "id": u.id,
            "name": u.full_name,
            "role": u.role,
            "specialization": spec,
            "unread_count": unread_dm,
            "last_message": last_dm.content if last_dm else "Xabarlar yo'q",
            "last_time": last_dm.created_at.isoformat() if last_dm else None,
            "is_group": False,
        })

    return channels


@router.get("/messages")
def get_messages(
    recipient_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tanlangan kanal yoki 1-on-1 chat bo'yicha xabarlarni qaytaradi va o'qildi deb belgilaydi."""
    if not recipient_id or recipient_id == "group" or recipient_id == "null":
        # Group chat
        messages = (
            db.query(ChatMessage)
            .options(joinedload(ChatMessage.sender))
            .filter(ChatMessage.recipient_id.is_(None))
            .order_by(ChatMessage.created_at.asc())
            .limit(150)
            .all()
        )

        # Mark group messages as read
        db.query(ChatMessage).filter(
            ChatMessage.recipient_id.is_(None),
            ChatMessage.sender_id != current_user.id,
            ChatMessage.is_read == False,
        ).update({"is_read": True}, synchronize_session=False)
        db.commit()

    else:
        # Direct DM chat
        try:
            target_id = int(recipient_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Noto'g'ri recipient_id")

        messages = (
            db.query(ChatMessage)
            .options(joinedload(ChatMessage.sender))
            .filter(
                or_(
                    and_(ChatMessage.sender_id == current_user.id, ChatMessage.recipient_id == target_id),
                    and_(ChatMessage.sender_id == target_id, ChatMessage.recipient_id == current_user.id),
                )
            )
            .order_by(ChatMessage.created_at.asc())
            .limit(150)
            .all()
        )

        # Mark DM messages from target user as read
        db.query(ChatMessage).filter(
            ChatMessage.sender_id == target_id,
            ChatMessage.recipient_id == current_user.id,
            ChatMessage.is_read == False,
        ).update({"is_read": True}, synchronize_session=False)
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
            "is_edited": getattr(m, 'is_edited', False) or False,
        }
        for m in messages
    ]


class EditMessageBody(BaseModel):
    content: str


@router.put("/messages/{message_id}")
def edit_message(
    message_id: int,
    body: EditMessageBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xabarni tahrirlash (faqat o'zi yuborgan foydalanuvchi yoki CEO/Admin)."""
    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Xabar topilmadi")

    if msg.sender_id != current_user.id and current_user.role not in ["ceo", "admin"]:
        raise HTTPException(status_code=403, detail="Faqat o'z xabaringizni tahrirlashingiz mumkin")

    if not body.content or not body.content.strip():
        raise HTTPException(status_code=400, detail="Xabar matni bo'sh bo'lishi mumkin emas")

    msg.content = body.content.strip()
    if hasattr(msg, 'is_edited'):
        msg.is_edited = True
    db.commit()
    db.refresh(msg)
    return {
        "success": True,
        "id": msg.id,
        "content": msg.content,
        "is_edited": True,
    }


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xabarni o'chirish. Bazadan ochirilgach ikkala tomondan ham avto yoqoladi."""
    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Xabar topilmadi")

    if msg.sender_id != current_user.id and current_user.role not in ["ceo", "admin"]:
        raise HTTPException(status_code=403, detail="Faqat o'z xabaringizni o'chirishingiz mumkin")

    db.delete(msg)
    db.commit()
    return {"success": True, "id": message_id}


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
        "is_edited": False,
    }


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Jami o'qilmagan xabarlar sonini qaytaradi (guruh va shaxsiy dmlar)."""
    count = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.sender_id != current_user.id,
            ChatMessage.is_read == False,
            or_(
                ChatMessage.recipient_id == current_user.id,
                ChatMessage.recipient_id.is_(None),
            ),
        )
        .count()
    )
    return {"unread": count}
