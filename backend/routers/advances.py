from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import extract
from sqlalchemy.orm import Session, joinedload
from datetime import datetime

from auth_utils import require_ceo
from database import get_db
from models.advance import Advance
from models.employee import Employee
from models.user import User
from services.audit import get_client_info, log_audit
from services.finance import cancel_advance, process_advance
from services.telegram_notify import send_telegram_message

router = APIRouter(prefix="/api/advances", tags=["advances"])


class AdvanceCreate(BaseModel):
    employee_id: int
    amount: int = Field(gt=0)
    note: str | None = None
    source: str | None = None


class CancelBody(BaseModel):
    reason: str = Field(min_length=3)


@router.get("")
def list_advances(db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    items = (
        db.query(Advance)
        .options(joinedload(Advance.employee))
        .order_by(Advance.created_at.desc())
        .limit(100)
        .all()
    )
    out = []
    for a in items:
        note = a.note
        source = None
        if note and note.startswith("[MANBA:") and "] " in note:
            source = note.split("] ", 1)[0].replace("[MANBA:", "").strip()
            note = note.split("] ", 1)[1]
        month = a.created_at.strftime("%Y-%m")
        month_adv_total = (
            db.query(Advance)
            .filter(
                Advance.employee_id == a.employee_id,
                Advance.is_cancelled == False,
                extract("year", Advance.created_at) == a.created_at.year,
                extract("month", Advance.created_at) == a.created_at.month,
            )
            .all()
        )
        total_adv = int(sum(x.amount for x in month_adv_total))
        base = int(a.employee.monthly_salary if a.employee else 0)
        out.append(
            {
                "id": a.id,
                "employee_id": a.employee_id,
                "employee_name": a.employee.full_name if a.employee else "?",
                "amount": a.amount,
                "note": note,
                "source": source,
                "is_cancelled": a.is_cancelled,
                "created_at": a.created_at.isoformat(),
                "month": month,
                "base_salary": base,
                "month_advances_total": total_adv,
                "remaining_salary": max(0, base - total_adv),
            }
        )
    return out


@router.post("")
def create_advance(
    data: AdvanceCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_ceo),
):
    emp = db.query(Employee).filter(Employee.id == data.employee_id, Employee.is_active == True).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    note = data.note
    if data.source:
        note = f"[MANBA: {data.source}] {note or ''}".strip()
    process_advance(db, data.amount, f"Avans: {emp.full_name}")
    adv = Advance(employee_id=data.employee_id, amount=data.amount, note=note, created_by=user.id)
    db.add(adv)
    db.flush()
    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="ADVANCE",
        table_name="advances", record_id=adv.id,
        new_data={"employee": emp.full_name, "amount": data.amount},
        ip_address=ip, device_info=device,
        detail_message=f"Avans berildi: {emp.full_name} — {data.amount:,} so'm".replace(",", " "),
    )
    db.commit()
    import asyncio
    import threading
    threading.Thread(
        target=lambda: asyncio.run(
            send_telegram_message(
                f"💸 Avans berildi\n👤 {emp.full_name}\n💰 {data.amount:,} so'm".replace(",", " "),
                section="finance",
            )
        ),
        daemon=True,
    ).start()
    return {"id": adv.id}


@router.post("/{advance_id}/cancel")
def cancel_advance_record(
    advance_id: int,
    body: CancelBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_ceo),
):
    adv = db.query(Advance).filter(Advance.id == advance_id).first()
    if not adv or adv.is_cancelled:
        raise HTTPException(status_code=400, detail="Avans topilmadi yoki bekor qilingan")
    cancel_advance(db, adv.amount)
    adv.is_cancelled = True
    adv.cancelled_at = datetime.utcnow()
    adv.cancelled_by = user.id
    adv.cancel_reason = body.reason
    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="CANCEL",
        table_name="advances", record_id=adv.id, reason=body.reason,
        ip_address=ip, device_info=device,
    )
    db.commit()
    import asyncio
    import threading
    threading.Thread(
        target=lambda: asyncio.run(
            send_telegram_message(
                f"❌ Avans bekor qilindi\n👤 {adv.employee.full_name if adv.employee else '?'}\n📝 Sabab: {body.reason}",
                section="cancellations",
            )
        ),
        daemon=True,
    ).start()
    return {"message": "Avans bekor qilindi"}
