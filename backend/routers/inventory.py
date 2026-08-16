from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models.inventory import InventoryItem
from models.user import User
from auth_utils import require_admin_or_ceo, require_ceo, require_doctor_or_admin_or_ceo

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


class InventoryCreate(BaseModel):
    # Bo'sh nom qabul qilinardi — omborda nomsiz material paydo bo'lardi
    name: str = Field(min_length=1, max_length=200)
    category: str = "Sarflash materiali"
    quantity: int = Field(default=0, ge=0)
    unit: str = "dona"
    min_quantity: int = Field(default=10, ge=0)
    unit_price: int = Field(default=0, ge=0) # Sotilish narxi (Kassa narxi)
    cost_price: int = Field(default=0, ge=0) # Tavar haqiqiy narxi (Tan narxi)
    notes: Optional[str] = None


class InventoryUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    min_quantity: Optional[int] = None
    unit_price: Optional[int] = None
    cost_price: Optional[int] = None
    notes: Optional[str] = None


class QuantityChangeBody(BaseModel):
    amount: int = Field(gt=0)
    patient_id: Optional[int] = None
    ticket_number: Optional[str] = None
    patient_name: Optional[str] = None
    charge_patient: bool = False
    payment_type: str = "later"
    price_per_unit: Optional[int] = None
    notes: Optional[str] = None


def _item_row(i: InventoryItem, role: Optional[str] = None) -> dict:
    data = {
        "id": i.id,
        "name": i.name,
        "category": i.category,
        "quantity": i.quantity,
        "unit": i.unit,
        "min_quantity": i.min_quantity,
        "unit_price": i.unit_price,
        "notes": i.notes,
        "is_low_stock": i.quantity <= i.min_quantity,
        "created_at": i.created_at.isoformat(),
    }
    if role == "ceo":
        data["cost_price"] = getattr(i, "cost_price", 0) or 0
    return data


@router.get("")
def list_inventory(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    q = db.query(InventoryItem)
    if category:
        q = q.filter(InventoryItem.category == category)
    items = q.order_by(InventoryItem.name.asc()).all()
    return [_item_row(i, user.role) for i in items]


@router.get("/logs")
def list_inventory_logs(
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    """Returns history of material usages with linked patient tickets and payments."""
    from models.audit_log import AuditLog
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.action_type == "CONSUME_MATERIAL")
        .order_by(AuditLog.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": l.id,
            "created_at": l.created_at.strftime("%d.%m.%Y %H:%M") if l.created_at else "",
            "user_role": l.user_role,
            "user_name": l.user.full_name if l.user else "Tizim",
            "detail_message": l.detail_message,
            "new_data": l.new_data,
        }
        for l in logs
    ]


@router.post("")
def create_inventory_item(
    body: InventoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    item = InventoryItem(
        name=body.name,
        category=body.category,
        quantity=body.quantity,
        unit=body.unit,
        min_quantity=body.min_quantity,
        unit_price=body.unit_price,
        cost_price=body.cost_price,
        notes=body.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_row(item, user.role)


@router.put("/{item_id}")
def update_inventory_item(
    item_id: int,
    body: InventoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Material topilmadi")
    if body.name is not None:
        item.name = body.name
    if body.category is not None:
        item.category = body.category
    if body.quantity is not None:
        item.quantity = body.quantity
    if body.unit is not None:
        item.unit = body.unit
    if body.min_quantity is not None:
        item.min_quantity = body.min_quantity
    if body.unit_price is not None:
        item.unit_price = body.unit_price
    if body.cost_price is not None:
        item.cost_price = body.cost_price
    if body.notes is not None:
        item.notes = body.notes

    item.updated_at = datetime.now()
    db.commit()
    db.refresh(item)
    return _item_row(item, user.role)


@router.post("/{item_id}/restock")
def restock_item(
    item_id: int,
    body: QuantityChangeBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Material topilmadi")
    item.quantity += body.amount
    item.updated_at = datetime.now()
    db.commit()
    db.refresh(item)
    return _item_row(item, user.role)


@router.post("/{item_id}/consume")
def consume_item(
    item_id: int,
    body: QuantityChangeBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Material topilmadi")
    if item.quantity < body.amount:
        raise HTTPException(status_code=400, detail=f"Omborda yetarli emas! Mavjud: {item.quantity} {item.unit}")

    item.quantity -= body.amount
    item.updated_at = datetime.now()

    # Find patient by patient_id, ticket_number, or patient_name
    from models.patient import Patient
    target_patient = None
    if body.patient_id:
        target_patient = db.query(Patient).filter(Patient.id == body.patient_id, Patient.is_cancelled == False).first()

    if not target_patient and body.ticket_number:
        clean_ticket = body.ticket_number.strip().upper()
        target_patient = (
            db.query(Patient)
            .filter(
                Patient.is_cancelled == False,
                or_(
                    Patient.ticket_number.ilike(clean_ticket),
                    Patient.ticket_number.ilike(f"%{clean_ticket}%"),
                ),
            )
            .order_by(Patient.created_at.desc())
            .first()
        )

    if not target_patient and body.patient_name:
        clean_name = body.patient_name.strip()
        target_patient = (
            db.query(Patient)
            .filter(
                Patient.is_cancelled == False,
                or_(
                    (Patient.first_name + " " + Patient.last_name).ilike(f"%{clean_name}%"),
                    Patient.first_name.ilike(f"%{clean_name}%"),
                ),
            )
            .order_by(Patient.created_at.desc())
            .first()
        )

    # Calculate total charge if charging patient
    charged_amount = 0
    if body.charge_patient:
        unit_p = body.price_per_unit if body.price_per_unit is not None else item.unit_price
        charged_amount = unit_p * body.amount

        if charged_amount > 0:
            from models.transaction import Transaction
            pay_tp = body.payment_type if body.payment_type in ("naqd", "cash", "karta", "card", "split") else "later"
            cash_amt = charged_amount if pay_tp in ("naqd", "cash") else 0
            card_amt = charged_amount if pay_tp in ("karta", "card") else 0

            txn = Transaction(
                patient_id=target_patient.id if target_patient else None,
                total_amount=charged_amount,
                center_amount=charged_amount,
                payment_type=pay_tp,
                cash_amount=cash_amt,
                card_amount=card_amt,
            )
            db.add(txn)

            if target_patient:
                clean_ticket = (target_patient.ticket_number or f"A-{target_patient.id:03d}").replace("-Material", "").replace("-material", "").strip()
                mat_patient = Patient(
                    first_name=target_patient.first_name,
                    last_name=target_patient.last_name,
                    birth_date=target_patient.birth_date,
                    phone=target_patient.phone,
                    address=target_patient.address,
                    referrer_id=target_patient.referrer_id,
                    provider_id=target_patient.provider_id,
                    service_id=target_patient.service_id,
                    payment_amount=charged_amount,
                    payment_type="later",
                    ticket_number=clean_ticket,
                    diagnosis=item.name,
                    queue_status="yakunlandi",
                    created_by=user.id,
                )
                db.add(mat_patient)

    # Audit logging
    pat_str = f" ({target_patient.first_name} {target_patient.last_name})" if target_patient else (f" [{body.ticket_number}]" if body.ticket_number else "")
    log_msg = f"Material sarflandi: {item.name} x {body.amount} {item.unit}{pat_str}"
    if charged_amount > 0:
        log_msg += f" (To'lov olindi: {charged_amount:,} so'm)"

    from services.audit import log_audit
    log_audit(
        db,
        user_id=user.id,
        user_role=user.role,
        action_type="CONSUME_MATERIAL",
        table_name="inventory_items",
        record_id=item.id,
        new_data={
            "item_name": item.name,
            "consumed": body.amount,
            "ticket": body.ticket_number,
            "charged": charged_amount,
            "cost_price": getattr(item, "cost_price", 0) or 0,
            "unit_price": unit_p,
        },
        detail_message=log_msg.replace(",", " "),
    )

    db.commit()
    db.refresh(item)
    
    result = _item_row(item, user.role)
    result["last_consumed"] = {
        "amount": body.amount,
        "ticket": body.ticket_number,
        "charged": charged_amount,
        "patient_name": f"{target_patient.first_name} {target_patient.last_name}" if target_patient else body.patient_name,
    }
    return result


@router.delete("/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Material topilmadi")
    db.delete(item)
    db.commit()
    return {"message": "Material o'chirildi"}
