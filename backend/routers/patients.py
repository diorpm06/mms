from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from auth_utils import require_admin_or_ceo, require_ceo, require_doctor_or_admin_or_ceo
from database import get_db
from models.patient import Patient
from models.provider import Provider
from models.referrer import Referrer
from models.service import Service
from models.transaction import Transaction
from models.user import User
from schemas import PatientCreate
from services.audit import get_client_info, log_audit
from services.finance import cancel_patient_payment, process_payment
from services.reports_data import daily_report
from services.sheets import add_patient_to_sheets
from services.sheets_backup import push_row_to_backup_url
from services.telegram_notify import send_telegram_message

def get_queue_prefix_letter(svc_obj: Service | None) -> str:
    if not svc_obj:
        return "A"
    cat = (svc_obj.category or "").strip().upper()
    sname = (svc_obj.name or "").strip().upper()
    
    # 1. Laboratory tests -> ALWAYS prefix "L"
    lab_keywords = ["LAB", "ANALIZ", "QON", "TAHLIL", "GORMON", "EKSPRESS", "TORCH", "GEPATIT", "BIOKIMY", "KOAGUL", "SIYDIK", "AJRALMA", "ALLERG", "REVMAT", "PARAZIT", "ELEKTR", "TEST"]
    if any(k in cat for k in lab_keywords) or any(k in sname for k in ["TAHLIL", "ANALIZ", "IFA", "IGG", "IGM"]):
        return "L"

    # 2. UZI -> ALWAYS prefix "U"
    if "UZI" in cat or "ULTRATOVUSH" in cat or "UZI" in sname:
        return "U"
        
    # 3. Massaj -> ALWAYS prefix "M"
    if "MASSAJ" in cat or "MASSAJ" in sname:
        return "M"

    # 4. Ineksiya / Ukol -> ALWAYS prefix "I"
    if "INEKSIYA" in cat or "INJEKT" in cat or "UKOL" in cat or "UKOL" in sname:
        return "I"

    # 5. Konsultatsiya -> ALWAYS prefix "K"
    if "KONSULTAT" in cat or "SHIFOKOR" in cat:
        return "K"

    if svc_obj.queue_prefix and svc_obj.queue_prefix.strip():
        p = svc_obj.queue_prefix.strip().upper()
        if p != "A":
            return p

    if cat and cat[0].isalpha():
        return cat[0]
    return "A"


def _next_ticket(db: Session) -> str:
    today = date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())
    today_count = db.query(Patient).filter(Patient.created_at >= start, Patient.created_at <= end).count()
    return f"A-{today_count + 1:03d}"


router = APIRouter(prefix="/api/patients", tags=["patients"])


class PatientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    birth_date: date | None = None
    phone: str | None = None
    address: str | None = None
    referrer_id: int | None = None
    provider_id: int | None = None
    service_id: int | None = None
    payment_amount: int | None = None
    payment_type: str | None = None
    reason: str = Field(min_length=3)


class CancelBody(BaseModel):
    reason: str = Field(min_length=3)


def _patient_row(p: Patient) -> dict:
    return {
        "id": p.id,
        "first_name": p.first_name,
        "last_name": p.last_name,
        "birth_date": p.birth_date.isoformat(),
        "phone": p.phone,
        "address": p.address,
        "referrer_id": p.referrer_id,
        "provider_id": p.provider_id,
        "service_id": p.service_id,
        "payment_amount": p.payment_amount,
        "payment_type": p.payment_type,
        "cash_amount": p.cash_amount or 0,
        "card_amount": p.card_amount or 0,
        "discount_amount": p.discount_amount or 0,
        "discount_reason": p.discount_reason,
        "diagnosis": p.diagnosis,
        "complaints": p.complaints,
        "prescription": p.prescription,
        "created_at": p.created_at.isoformat(),
        "created_by": p.created_by,
        "is_cancelled": p.is_cancelled,
        "cancel_reason": p.cancel_reason,
        "ticket_number": p.ticket_number or f"A-{p.id:03d}",
        "queue_status": p.queue_status or "kutmoqda",
        "cabinet": p.cabinet,
        "referrer_name": p.referrer.full_name if p.referrer else None,
        "provider_name": p.provider.full_name if p.provider else None,
        "service_name": p.service.name if p.service else None,
        "service_category": p.service.category if p.service else "Umumiy",
        "category": p.service.category if p.service else "Umumiy",
        "creator_name": p.creator.full_name if p.creator else None,
    }


def _patient_to_dict(p: Patient, db: Session) -> dict:
    ref = db.query(Referrer).filter(Referrer.id == p.referrer_id).first() if p.referrer_id else None
    prov = db.query(Provider).filter(Provider.id == p.provider_id).first()
    svc = db.query(Service).filter(Service.id == p.service_id).first()
    return {
        "created_at": p.created_at,
        "first_name": p.first_name,
        "last_name": p.last_name,
        "birth_date": p.birth_date.strftime("%d.%m.%Y"),
        "phone": p.phone,
        "address": p.address,
        "referrer_name": ref.full_name if ref else "—",
        "provider_name": prov.full_name if prov else "",
        "service_name": svc.name if svc else "",
        "payment_amount": p.payment_amount,
        "payment_type": p.payment_type,
        "holat": "bekor" if p.is_cancelled else "aktiv",
    }


def _sync_patient_background(patient_ids: list[int], user_role: str, first_name: str, last_name: str, payment_type: str, total_paid: int):
    from database import SessionLocal
    import logging
    logger = logging.getLogger(__name__)
    db = SessionLocal()
    try:
        patients = db.query(Patient).filter(Patient.id.in_(patient_ids)).all()
        for p in patients:
            try:
                row_dict = _patient_to_dict(p, db)
                add_patient_to_sheets(row_dict)
                push_row_to_backup_url(row_dict)
            except Exception as e:
                logger.error("Sheet/Backup error: %s", e)

        p_names = ", ".join([f"{p.first_name} {p.last_name}".strip() for p in patients])
        svc_names = ", ".join([p.service.name for p in patients if p.service])
        msg = (
            f"👤 YANGI MIJOZ RO'YXATGA OLINDI!\n"
            f"📝 F.I.Sh: {p_names}\n"
            f"🩺 Xizmat: {svc_names}\n"
            f"💰 To'lov: {total_paid:,} so'm ({payment_type})\n"
            f"📅 Vaqt: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
        ).replace(",", " ")
        
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        loop.run_until_complete(send_telegram_message(msg, section="registration"))
    except Exception as e:
        logger.error("_sync_patient_background error: %s", e)
    finally:
        db.close()


@router.get("/today")
def today_patients(db: Session = Depends(get_db), _: User = Depends(require_doctor_or_admin_or_ceo)):
    today = date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())
    patients = (
        db.query(Patient)
        .options(
            joinedload(Patient.referrer),
            joinedload(Patient.provider),
            joinedload(Patient.service),
            joinedload(Patient.creator),
        )
        .filter(Patient.created_at >= start, Patient.created_at <= end)
        .order_by(Patient.created_at.desc())
        .all()
    )
    return [_patient_row(p) for p in patients]


@router.get("")
def search_patients(
    search: str = "",
    include_cancelled: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    q = db.query(Patient).options(
        joinedload(Patient.referrer),
        joinedload(Patient.provider),
        joinedload(Patient.service),
        joinedload(Patient.creator),
    )
    if not include_cancelled:
        q = q.filter(Patient.is_cancelled == False)
    if search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
                Patient.phone.ilike(term),
            )
        )
    patients = q.order_by(Patient.created_at.desc()).limit(100).all()
    return [_patient_row(p) for p in patients]


@router.get("/autocomplete")
def autocomplete_patients(
    q: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    query_str = q.strip()
    if not query_str or len(query_str) < 2:
        return []

    term = f"%{query_str}%"
    filters = [
        Patient.first_name.ilike(term),
        Patient.last_name.ilike(term),
        Patient.phone.ilike(term),
        Patient.address.ilike(term),
    ]

    # If query is a 4-digit birth year (e.g. 1995)
    if query_str.isdigit() and len(query_str) == 4:
        from sqlalchemy import extract
        filters.append(extract("year", Patient.birth_date) == int(query_str))

    patients = (
        db.query(Patient)
        .filter(
            Patient.is_cancelled == False,
            or_(*filters),
        )
        .order_by(Patient.created_at.desc())
        .limit(60)
        .all()
    )

    # Group by unique patient identity (first_name, last_name, birth_date)
    unique_patients = {}
    for p in patients:
        fn = (p.first_name or "").strip().lower()
        ln = (p.last_name or "").strip().lower()
        bd = p.birth_date.isoformat() if p.birth_date else ""
        key = f"{fn}_{ln}_{bd}"

        if key not in unique_patients:
            full_name = f"{p.first_name} {p.last_name}".strip()
            birth_year = p.birth_date.year if p.birth_date else None
            birth_str = p.birth_date.strftime("%d.%m.%Y") if p.birth_date else ""

            unique_patients[key] = {
                "id": p.id,
                "first_name": p.first_name,
                "last_name": p.last_name,
                "full_name": full_name,
                "birth_date": birth_str,
                "birth_year": birth_year,
                "phone": p.phone or "",
                "address": p.address or "",
                "referrer_id": p.referrer_id,
                "last_visit": p.created_at.strftime("%d.%m.%Y"),
                "visit_count": 1,
            }
        else:
            unique_patients[key]["visit_count"] += 1

    return list(unique_patients.values())[:10]



def _sync_patient_background(patient_ids: list, user_role: str, first_name: str, last_name: str, payment_type: str, total_batch_paid: int):
    """Executes Google Sheets sync, backup webhook, and Telegram notification asynchronously."""
    from database import SessionLocal
    import asyncio

    db = SessionLocal()
    try:
        patients = db.query(Patient).filter(Patient.id.in_(patient_ids)).all()
        for p in patients:
            try:
                row = _patient_to_dict(p, db)
                add_patient_to_sheets(row)
                push_row_to_backup_url(row)
            except Exception as e:
                print(f"[BG Sync Sheets Warning]: {e}")

        report = daily_report(db, date.today())
        svc_names = ", ".join(p.service.name if (p.service and p.service.name) else "Xizmat" for p in patients)
        msg = (
            f"🆕 Yangi mijoz qabul qilindi ({user_role})\n"
            f"👤 {first_name} {last_name}\n"
            f"🩺 Xizmatlar: {svc_names}\n"
            f"💳 To'lov turi: {payment_type.upper()}\n"
            f"💰 Jami: {total_batch_paid:,} so'm\n"
            f"💼 Balans: {report['current_balance']:,} so'm"
        ).replace(",", " ")
        asyncio.run(send_telegram_message(msg, section="registration"))
    except Exception as ex:
        print(f"[BG Task Error]: {ex}")
    finally:
        db.close()


@router.post("")
async def create_patient(
    data: PatientCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    # Construct list of services to create
    service_items = []
    if data.services and len(data.services) > 0:
        for s in data.services:
            svc = db.query(Service).filter(Service.id == s.service_id, Service.is_active == True).first()
            if not svc:
                raise HTTPException(status_code=400, detail=f"Xizmat (ID: {s.service_id}) topilmadi")
            qty = s.quantity if (s.quantity and s.quantity > 0) else 1
            unit_price = s.price if s.price is not None else svc.price
            price = unit_price * qty
            service_items.append({
                "service_id": s.service_id,
                "provider_id": s.provider_id,
                "price": price,
                "quantity": qty,
                "unit_price": unit_price,
            })
    elif data.service_id:
        svc = db.query(Service).filter(Service.id == data.service_id, Service.is_active == True).first()
        if not svc:
            raise HTTPException(status_code=400, detail="Xizmat topilmadi")
        price = data.payment_amount if data.payment_amount is not None else svc.price
        service_items.append({"service_id": data.service_id, "provider_id": data.provider_id, "price": price})
    else:
        raise HTTPException(status_code=400, detail="Kamida bitta xizmat tanlang")

    # Split F.I.Sh into first_name and last_name if single string provided
    first_name_clean = data.first_name.strip()
    last_name_clean = (data.last_name or "").strip()
    if not last_name_clean and " " in first_name_clean:
        parts = first_name_clean.split(" ", 1)
        first_name_clean = parts[0]
        last_name_clean = parts[1]

    ip, device = get_client_info(request)
    created_patients = []
    total_batch_paid = 0
    total_raw_price = sum(item["price"] for item in service_items)
    discount_total = data.discount_amount or 0

    # Group service_items by department/category (or queue prefix letter)
    # So multiple services in UZI get 1 single UZI ticket (e.g. U-001)
    # Multiple services in Laboratoriya get 1 single Laboratoriya ticket (e.g. L-001)
    department_groups = {}
    for item in service_items:
        svc_obj = db.query(Service).filter(Service.id == item["service_id"]).first()
        svc_prefix = get_queue_prefix_letter(svc_obj)
        svc_cat = (svc_obj.category or "").strip() if svc_obj else "Umumiy"
        
        # Group strictly by queue prefix letter (e.g. "L" for all Laboratoriya tests, "U" for all UZI)
        dep_key = svc_prefix
        if dep_key not in department_groups:
            department_groups[dep_key] = {
                "prefix": svc_prefix,
                "category": svc_cat,
                "items": [],
            }
        department_groups[dep_key]["items"].append(item)

    for dep_key, dep_data in department_groups.items():
        group_items = dep_data["items"]
        primary_item = group_items[0]

        if data.custom_date:
            target_day = data.custom_date
            visit_created_at = datetime.combine(data.custom_date, datetime.now().time())
            initial_queue_status = "yakunlandi"
        else:
            target_day = date.today()
            visit_created_at = datetime.utcnow()

        start = datetime.combine(target_day, datetime.min.time())
        end = datetime.combine(target_day, datetime.max.time())

        svc_obj = db.query(Service).filter(Service.id == primary_item["service_id"]).first()
        svc_cabinet = svc_obj.cabinet if (svc_obj and svc_obj.cabinet) else "1-Xona"
        svc_requires_queue = any(
            (db.query(Service).filter(Service.id == it["service_id"]).first().requires_queue)
            for it in group_items
        ) if not data.custom_date else False

        svc_prefix = dep_data["prefix"]

        if svc_requires_queue:
            prefix_pattern = f"{svc_prefix}-%"
            prefix_count = db.query(Patient).filter(
                Patient.created_at >= start,
                Patient.created_at <= end,
                Patient.ticket_number.like(prefix_pattern),
            ).count()
            ticket_num = f"{svc_prefix}-{prefix_count + 1:03d}"
            initial_queue_status = "kutmoqda"
        else:
            ticket_num = None
            initial_queue_status = "yakunlandi"

        group_raw_price = sum(it["price"] for it in group_items)
        if total_raw_price > 0 and discount_total > 0:
            group_discount = int((group_raw_price / total_raw_price) * discount_total)
        else:
            group_discount = 0

        final_group_price = max(0, group_raw_price - group_discount)

        group_cash = 0
        group_card = 0
        if data.payment_type in ("split", "aralash"):
            batch_final_total = max(1, sum(max(0, it["price"] - (int((it["price"] / total_raw_price) * discount_total) if total_raw_price > 0 and discount_total > 0 else 0)) for it in service_items))
            ratio = final_group_price / batch_final_total
            group_cash = int((data.cash_amount or 0) * ratio)
            group_card = max(0, final_group_price - group_cash)
        elif data.payment_type in ("cash", "naqd"):
            group_cash = final_group_price
            group_card = 0
        elif data.payment_type in ("later", "keyinroq", "nasiya", "qarz"):
            group_cash = 0
            group_card = 0
        else:
            group_cash = 0
            group_card = final_group_price

        assigned_provider_id = primary_item.get("provider_id")
        if not assigned_provider_id and svc_obj:
            from models.provider import ProviderService
            ps_link = db.query(ProviderService).filter(ProviderService.service_id == svc_obj.id).first()
            if ps_link:
                assigned_provider_id = ps_link.provider_id
            else:
                svc_cat_lower = (svc_obj.category or "").strip().lower()
                svc_name_lower = (svc_obj.name or "").strip().lower()
                spec_term = svc_cat_lower if (svc_cat_lower and svc_cat_lower != "umumiy") else svc_name_lower
                if spec_term:
                    matched_prov = db.query(Provider).filter(
                        Provider.is_active == True,
                        Provider.specialization.ilike(f"%{spec_term}%")
                    ).first()
                    if matched_prov:
                        assigned_provider_id = matched_prov.id

        patient = Patient(
            first_name=first_name_clean,
            last_name=last_name_clean,
            birth_date=data.birth_date,
            phone=data.phone or "",
            address=data.address,
            referrer_id=data.referrer_id,
            provider_id=assigned_provider_id,
            service_id=primary_item["service_id"],
            payment_amount=final_group_price,
            payment_type=data.payment_type,
            cash_amount=group_cash,
            card_amount=group_card,
            discount_amount=group_discount,
            discount_reason=data.discount_reason,
            created_by=user.id,
            ticket_number=ticket_num,
            queue_status=initial_queue_status,
            cabinet=svc_cabinet,
            created_at=visit_created_at,
        )
        db.add(patient)
        db.flush()
        process_payment(db, patient)
        total_batch_paid += final_group_price

        log_audit(
            db, user_id=user.id, user_role=user.role, action_type="CREATE",
            table_name="patients", record_id=patient.id,
            new_data={"name": f"{patient.first_name} {patient.last_name}"},
            ip_address=ip, device_info=device,
            detail_message=f"Yangi mijoz qo'shildi: {patient.last_name} {patient.first_name}",
        )
        sub_items = []
        for it in group_items:
            s_obj = db.query(Service).filter(Service.id == it["service_id"]).first()
            if s_obj:
                sub_items.append({
                    "service_name": s_obj.name,
                    "category": s_obj.category or "Umumiy",
                    "price": it["price"],
                    "quantity": it.get("quantity", 1),
                })
        
        row_dict = _patient_row(patient)
        row_dict["sub_items"] = sub_items
        created_patients.append(row_dict)

    db.commit()

    # Queue background sync tasks (Google Sheets, Backup URL, Telegram) asynchronously
    patient_ids = [p["id"] for p in created_patients]
    background_tasks.add_task(
        _sync_patient_background,
        patient_ids,
        user.role,
        data.first_name,
        data.last_name or "",
        data.payment_type,
        total_batch_paid,
    )

    if len(created_patients) == 1:
        return created_patients[0]
    return {
        "batch": True,
        "count": len(created_patients),
        "total_amount": total_batch_paid,
        "cash_amount": sum(p.get("cash_amount", 0) for p in created_patients),
        "card_amount": sum(p.get("card_amount", 0) for p in created_patients),
        "patients": created_patients,
    }


@router.get("/{patient_id}")
def get_patient(patient_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    p = (
        db.query(Patient)
        .options(
            joinedload(Patient.referrer),
            joinedload(Patient.provider),
            joinedload(Patient.service),
            joinedload(Patient.creator),
        )
        .filter(Patient.id == patient_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")
    return _patient_row(p)


@router.put("/{patient_id}")
def update_patient(
    patient_id: int,
    data: PatientUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_ceo),
):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")
    if p.is_cancelled:
        raise HTTPException(status_code=400, detail="Bekor qilingan yozuvni tahrirlab bo'lmaydi")
    old = _patient_row(p)
    updates = data.model_dump(exclude_unset=True, exclude={"reason"})
    for k, v in updates.items():
        setattr(p, k, v)
    p.updated_at = datetime.utcnow()
    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="UPDATE",
        table_name="patients", record_id=p.id,
        old_data=old, new_data=_patient_row(p), reason=data.reason,
        ip_address=ip, device_info=device,
    )
    db.commit()
    return _patient_row(p)


@router.post("/{patient_id}/cancel")
def cancel_patient(
    patient_id: int,
    body: CancelBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p or p.is_cancelled:
        raise HTTPException(status_code=400, detail="Topilmadi yoki bekor qilingan")
    tx = db.query(Transaction).filter(Transaction.patient_id == p.id, Transaction.is_cancelled == False).first()
    if not tx:
        raise HTTPException(status_code=400, detail="Tranzaksiya topilmadi")
    p.is_cancelled = True
    p.cancelled_at = datetime.utcnow()
    p.is_cancelled = True
    p.cancel_reason = body.reason
    p.updated_at = datetime.utcnow()
    cancel_patient_payment(db, p, tx)
    ip, device = get_client_info(request)
    log_audit(
        db, user_id=user.id, user_role=user.role, action_type="CANCEL",
        table_name="patients", record_id=p.id, reason=body.reason,
        ip_address=ip, device_info=device,
        detail_message=f"To'lov bekor qilindi — sabab: {body.reason}, kim: {user.full_name}",
    )
    db.commit()
    return {"status": "ok"}


@router.post("/{patient_id}/reissue-ticket")
def reissue_ticket(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")
    if p.is_cancelled:
        raise HTTPException(status_code=400, detail="Bekor qilingan bemorga navbat berib bo'lmaydi")

    svc_obj = db.query(Service).filter(Service.id == p.service_id).first()
    svc_prefix = get_queue_prefix_letter(svc_obj)

    today = date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())

    prefix_pattern = f"{svc_prefix}-%"
    prefix_count = db.query(Patient).filter(
        Patient.created_at >= start,
        Patient.created_at <= end,
        Patient.ticket_number.like(prefix_pattern),
    ).count()

    new_ticket_num = f"{svc_prefix}-{prefix_count + 1:03d}"
    p.ticket_number = new_ticket_num
    p.queue_status = "kutmoqda"
    p.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(p)
    return _patient_row(p)


class PayLaterBody(BaseModel):
    payment_type: str = "naqd"  # naqd | karta | split
    cash_amount: Optional[int] = 0
    card_amount: Optional[int] = 0


@router.post("/{patient_id}/pay-later")
def mark_patient_paid(
    patient_id: int,
    body: PayLaterBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")

    pay_type = body.payment_type if body.payment_type in ("naqd", "karta", "card", "cash", "split", "aralash") else "naqd"
    p.payment_type = pay_type

    amount = p.payment_amount or 0
    if pay_type in ("split", "aralash"):
        p.cash_amount = body.cash_amount or 0
        p.card_amount = body.card_amount or max(0, amount - p.cash_amount)
    elif pay_type in ("cash", "naqd"):
        p.cash_amount = amount
        p.card_amount = 0
    else:
        p.cash_amount = 0
        p.card_amount = amount

    p.updated_at = datetime.utcnow()

    # Update existing transaction if present, or process payment
    tx = db.query(Transaction).filter(Transaction.patient_id == p.id, Transaction.is_cancelled == False).first()
    if tx:
        tx.payment_type = pay_type
        tx.cash_amount = p.cash_amount
        tx.card_amount = p.card_amount
        tx.total_amount = amount
    else:
        process_payment(db, p)

    db.commit()
    db.refresh(p)
    return {"message": f"Bemor {p.ticket_number or p.first_name} to'lovi ({pay_type.upper()}) qabul qilindi", "patient": _patient_row(p)}


@router.get("/{patient_id}/visits")
def patient_visits(patient_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_ceo)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")
    visits = (
        db.query(Patient)
        .options(joinedload(Patient.service), joinedload(Patient.provider))
        .filter(
            or_(
                Patient.phone == p.phone,
                (Patient.first_name == p.first_name) & (Patient.last_name == p.last_name),
            )
        )
        .order_by(Patient.created_at.desc())
        .all()
    )
    return [
        {
            "id": v.id,
            "service_name": v.service.name if v.service else None,
            "provider_name": v.provider.full_name if v.provider else None,
            "payment_amount": v.payment_amount,
            "payment_type": v.payment_type,
            "created_at": v.created_at.isoformat(),
            "is_cancelled": v.is_cancelled,
        }
        for v in visits
    ]


class MedicalRecordBody(BaseModel):
    diagnosis: str | None = None
    complaints: str | None = None
    prescription: str | None = None


@router.post("/{patient_id}/medical-record")
def save_medical_record(
    patient_id: int,
    body: MedicalRecordBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")

    if body.diagnosis is not None:
        p.diagnosis = body.diagnosis
    if body.complaints is not None:
        p.complaints = body.complaints
    if body.prescription is not None:
        p.prescription = body.prescription

    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return _patient_row(p)


@router.delete("/{patient_id}")
def delete_patient(
    patient_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_ceo),
):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")

    ip, ua = get_client_info(request)
    log_audit(
        db,
        user.id,
        "DELETE_PATIENT",
        "Patient",
        p.id,
        f"Bemor o'chirildi: {p.first_name} {p.last_name} ({p.phone})",
        ip,
        ua,
    )

    db.query(Transaction).filter(Transaction.patient_id == p.id).delete()
    db.delete(p)
    db.commit()
    return {"message": "Bemor muvaffaqiyatli o'chirildi"}

