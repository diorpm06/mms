from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from auth_utils import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    require_ceo,
    verify_password,
)
from database import get_db
from models.session_log import SessionLog
from models.user import User
from schemas import LoginRequest, TokenResponse, UserOut
from services.audit import get_client_info, log_audit


class RefreshRequest(BaseModel):
    refresh_token: str


router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username, User.is_active == True).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login yoki parol noto'g'ri")
    ip, device = get_client_info(request)
    session = SessionLog(user_id=user.id, ip_address=ip, device_info=device)
    db.add(session)
    log_audit(
        db,
        user_id=user.id,
        user_role=user.role,
        action_type="LOGIN",
        table_name="users",
        record_id=user.id,
        ip_address=ip,
        device_info=device,
        detail_message=f"{user.full_name} tizimga kirdi — {datetime.utcnow().strftime('%d.%m.%Y %H:%M')}",
    )
    db.commit()
    token_data = {"sub": str(user.id), "role": user.role, "session_id": str(session.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=user.role,
        full_name=user.full_name,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token yaroqsiz")
    user = db.query(User).filter(User.id == int(payload["sub"]), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Foydalanuvchi topilmadi")
    token_data = {"sub": str(user.id), "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=user.role,
        full_name=user.full_name,
    )


@router.post("/logout")
def logout(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ip, device = get_client_info(request)
    session = (
        db.query(SessionLog)
        .filter(SessionLog.user_id == user.id, SessionLog.logout_at.is_(None))
        .order_by(SessionLog.login_at.desc())
        .first()
    )
    if session:
        session.logout_at = datetime.utcnow()
        session.duration_seconds = int((session.logout_at - session.login_at).total_seconds())
    log_audit(
        db,
        user_id=user.id,
        user_role=user.role,
        action_type="LOGOUT",
        table_name="users",
        record_id=user.id,
        ip_address=ip,
        device_info=device,
        detail_message=f"{user.full_name} tizimdan chiqdi",
    )
    db.commit()
    return {"message": "Chiqildi"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/users")
def list_users(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [{"id": u.id, "full_name": u.full_name, "role": u.role} for u in db.query(User).filter(User.is_active == True).all()]


class PasswordChangeBody(BaseModel):
    user_id: int
    new_password: str = Field(min_length=6)
    new_username: str | None = Field(default=None, min_length=3, max_length=50)


@router.post("/change-password")
def change_password(
    body: PasswordChangeBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_ceo),
):
    target = db.query(User).filter(User.id == body.user_id, User.is_active == True).first()
    if not target:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    if body.new_username and body.new_username != target.username:
        exists = (
            db.query(User)
            .filter(User.username == body.new_username, User.id != target.id, User.is_active == True)
            .first()
        )
        if exists:
            raise HTTPException(status_code=400, detail="Bu login allaqachon band")
        target.username = body.new_username

    target.hashed_password = hash_password(body.new_password)
    ip, device = get_client_info(request)
    detail = f"{target.full_name} paroli o'zgartirildi"
    if body.new_username:
        detail += f", login: {target.username}"
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="UPDATE",
        table_name="users", record_id=target.id,
        ip_address=ip, device_info=device,
        detail_message=detail,
    )
    db.commit()
    return {"message": "Login/parol yangilandi"}
