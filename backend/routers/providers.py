from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_utils import hash_password, require_admin_or_ceo, require_ceo, require_doctor_or_admin_or_ceo
from database import get_db
from models.expense import Expense
from models.provider import Provider, ProviderService
from models.user import User
from schemas import ProviderCreate, ProviderOut, ProviderUpdate
from services.finance import payout_recipient_balance

router = APIRouter(prefix="/api/providers", tags=["providers"])


class PayoutBody(BaseModel):
    source: str | None = None


@router.get("", response_model=list[ProviderOut])
def list_providers(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_doctor_or_admin_or_ceo),
):
    q = db.query(Provider)
    if active_only:
        q = q.filter(Provider.is_active == True)
    providers = q.order_by(Provider.full_name).all()

    provider_ids = [p.id for p in providers]
    user_map = {}
    if provider_ids:
        users = db.query(User).filter(User.provider_id.in_(provider_ids), User.is_active == True).all()
        for u in users:
            user_map[u.provider_id] = u.username

    # Balans bitta yig'ma raqam — u qaysi kundan yig'ilganini ko'rsatmaydi.
    # Jadvalda "Bugun" va "Jami ishlagan" ustunlari bo'lishi uchun shu
    # ikkalasi tranzaksiyalardan hisoblanadi.
    from services.earnings_daily import providers_summary
    xulosa = providers_summary(db, providers)

    res = []
    for p in providers:
        item = ProviderOut.model_validate(p)
        item.username = user_map.get(p.id)
        item.service_ids = [s.id for s in p.services] if p.services else []
        x = xulosa.get(p.id) or {}
        item.today_earned = x.get("today", 0)
        item.total_earned = x.get("total_earned", 0)
        res.append(item)

    return res


@router.get("/{provider_id}/earnings-daily")
def provider_earnings_daily(
    provider_id: int,
    limit: int = 60,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """Shifokorning ishlagan puli kunma-kun: jami qaysi kundan kelgani."""
    from services.earnings_daily import provider_daily
    natija = provider_daily(db, provider_id, limit)
    if not natija:
        raise HTTPException(status_code=404, detail="Shifokor topilmadi")
    return natija


@router.get("/{provider_id}/earnings-daily/{kun}")
def provider_earnings_day(
    provider_id: int,
    kun: date,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """Bir kundagi bemorlar — o'sha kunning summasi qanday yig'ilgani."""
    from services.earnings_daily import provider_day_patients
    return provider_day_patients(db, provider_id, kun)


@router.post("", response_model=ProviderOut)
def create_provider(data: ProviderCreate, db: Session = Depends(get_db), _: User = Depends(require_ceo)):
    if data.username:
        exists = db.query(User).filter(User.username == data.username).first()
        if exists:
            raise HTTPException(status_code=400, detail=f"'{data.username}' nomli login allaqachon band")
        if not data.password:
            raise HTTPException(status_code=400, detail="Login kiritilganda parol ham kiritilishi kerak")

    service_ids = data.service_ids or []
    provider_data = data.model_dump(exclude={"username", "password", "service_ids"})
    p = Provider(**provider_data)
    db.add(p)
    db.commit()
    db.refresh(p)

    if service_ids:
        for sid in service_ids:
            db.add(ProviderService(provider_id=p.id, service_id=sid))
        db.commit()

    if data.username and data.password:
        u = User(
            full_name=p.full_name,
            role="doctor",
            username=data.username,
            hashed_password=hash_password(data.password),
            plain_password=data.password,
            provider_id=p.id,
            is_active=True,
        )
        db.add(u)
        db.commit()

    res = ProviderOut.model_validate(p)
    res.username = data.username
    res.service_ids = service_ids
    return res


@router.put("/{provider_id}", response_model=ProviderOut)
def update_provider(
    provider_id: int, data: ProviderUpdate, db: Session = Depends(get_db), _: User = Depends(require_ceo)
):
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider topilmadi")

    update_dict = data.model_dump(exclude_unset=True)
    username = update_dict.pop("username", None)
    password = update_dict.pop("password", None)
    service_ids = update_dict.pop("service_ids", None)

    for k, v in update_dict.items():
        setattr(p, k, v)
    db.commit()

    if service_ids is not None:
        db.query(ProviderService).filter(ProviderService.provider_id == p.id).delete()
        for sid in service_ids:
            db.add(ProviderService(provider_id=p.id, service_id=sid))
        db.commit()

    db.refresh(p)

    linked_user = db.query(User).filter(User.provider_id == p.id, User.is_active == True).first()
    if username:
        if linked_user:
            if username != linked_user.username:
                exists = db.query(User).filter(User.username == username, User.id != linked_user.id).first()
                if exists:
                    raise HTTPException(status_code=400, detail=f"'{username}' login allaqachon band")
                linked_user.username = username
            linked_user.full_name = p.full_name
            if password:
                linked_user.hashed_password = hash_password(password)
                linked_user.plain_password = password
        else:
            if not password:
                raise HTTPException(status_code=400, detail="Yangi akkaunt uchun parol kiritishingiz shart")
            linked_user = User(
                full_name=p.full_name,
                role="doctor",
                username=username,
                hashed_password=hash_password(password),
                plain_password=password,
                provider_id=p.id,
                is_active=True,
            )
            db.add(linked_user)
        db.commit()

    res = ProviderOut.model_validate(p)
    res.username = linked_user.username if linked_user else None
    res.service_ids = [s.id for s in p.services] if p.services else []
    return res


@router.delete("/{provider_id}")
def delete_provider(
    provider_id: int,
    hard: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_ceo)
):
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider topilmadi")

    users = db.query(User).filter(User.provider_id == provider_id).all()

    if hard:
        for u in users:
            db.delete(u)
        db.delete(p)
    else:
        p.is_active = not p.is_active
        for u in users:
            u.is_active = p.is_active

    db.commit()
    return {"message": "Status o'zgartirildi / O'chirildi", "is_active": p.is_active if not hard else False}



@router.post("/{provider_id}/payout")
def payout_provider(
    provider_id: int,
    body: PayoutBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ceo),
):
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    payout = payout_recipient_balance(db, "provider", provider_id, source=body.source)
    if payout and payout.amount > 0:
        doc_name = p.full_name if p else f"#{provider_id}"
        src = body.source or "Naqt kassa"
        exp = Expense(
            description=f"[MANBA: {src}] Shifokor maoshi: {doc_name}",
            amount=payout.amount,
            created_by=user.id,
            category="Oylik",
        )
        db.add(exp)
    qoplandi = getattr(payout, "settled_from_advance", 0) or 0
    db.commit()
    msg = "Balans chiqarildi"
    if qoplandi:
        msg = (f"{qoplandi:,} so'm avans qarzidan qoplandi"
               + (f", qo'lga {payout.amount:,} so'm berildi" if payout.amount else ", qo'lga pul berilmadi"))
    return {
        "message": msg,
        "amount": payout.amount,
        "settled_from_advance": qoplandi,
        "source": body.source,
    }


from datetime import date, datetime
from sqlalchemy import func
from models.patient import Patient
from models.employee import Employee
from models.advance import Advance
from models.provider_advance import ProviderAdvance


@router.get("/advance-summaries")
def all_provider_advances(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    """
    Har bir shifokorning qoplanmagan avansi — bitta so'rovda.

    Avans ProviderAdvance jadvaliga yozilardi, lekin CEO panelidagi
    "Shifokorlar" bo'limida uni ko'rsatadigan joy yo'q edi: faqat balans
    chiqardi. Shu sababli avans berilgani ko'rinmasdi.
    """
    out = {}
    for pr in db.query(Provider).all():
        advances = (
            db.query(ProviderAdvance)
            .filter(
                ProviderAdvance.recipient_type == "provider",
                ProviderAdvance.recipient_id == pr.id,
                ProviderAdvance.is_settled == False,
            )
            .all()
        )
        # remaining maydoni bo'lsa qoplanmagan qismini, bo'lmasa to'liq summani olamiz
        jami = int(sum((getattr(a, "remaining", None) or a.amount) for a in advances))
        balans = int(pr.balance or 0)
        out[str(pr.id)] = {
            "advances_total": jami,
            "advances_count": len(advances),
            "balance": balans,
            # Ishlagani avansdan kam bo'lsa — shifokor qarzda
            "remaining": max(0, balans - jami),
            "debt": max(0, jami - balans),
        }
    return out


@router.get("/{provider_id}/payroll-summary")
def get_provider_payroll_summary(
    provider_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_ceo),
):
    today = date.today()
    start_dt = datetime(today.year, today.month, 1)
    if today.month == 12:
        end_dt = datetime(today.year + 1, 1, 1)
    else:
        end_dt = datetime(today.year, today.month + 1, 1)

    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Shifokor topilmadi")

    patients = (
        db.query(Patient)
        .filter(
            Patient.provider_id == p.id,
            Patient.created_at >= start_dt,
            Patient.created_at < end_dt,
            Patient.is_cancelled == False,
        )
        .all()
    )

    base_fixed = getattr(p, 'fixed_salary', 0) or 0
    kpi_earned = 0
    from services.finance import calculate_financial_split
    for pt in patients:
        svc = pt.service
        ref_comm_sum = svc.referrer_commission_sum if svc else 0
        ref_comm_pct = (svc.referrer_commission_percent if (svc and svc.referrer_commission_percent) else 0) if pt.referrer_id else 0
        ref_doc_split_pct = svc.referrer_doctor_split_percent if svc else None
        ref_doc_split_sum = svc.referrer_doctor_split_sum if svc else 0

        _, prov_amt, _ = calculate_financial_split(
            total=pt.payment_amount or 0,
            provider_percentage=p.percentage or 0,
            referrer_percentage=ref_comm_pct,
            referrer_commission_sum=ref_comm_sum,
            ref_doc_split_pct=ref_doc_split_pct if pt.referrer_id else None,
            ref_doc_split_sum=ref_doc_split_sum if pt.referrer_id else 0,
        )
        kpi_earned += prov_amt

    doctor_share = base_fixed + kpi_earned

    adv_sum = (
        db.query(func.coalesce(func.sum(ProviderAdvance.amount), 0))
        .filter(
            ProviderAdvance.recipient_type == "provider",
            ProviderAdvance.recipient_id == p.id,
            ProviderAdvance.created_at >= start_dt,
            ProviderAdvance.created_at < end_dt,
        )
        .scalar()
    )
    advances_total = int(adv_sum or 0)

    emp = db.query(Employee).filter(Employee.full_name == p.full_name).first()
    if emp:
        adv_sum_emp = (
            db.query(func.coalesce(func.sum(Advance.amount), 0))
            .filter(
                Advance.employee_id == emp.id,
                Advance.created_at >= start_dt,
                Advance.created_at < end_dt,
                Advance.is_cancelled == False,
            )
            .scalar()
        )
        advances_total += int(adv_sum_emp or 0)

    return {
        "base_salary": doctor_share,
        "fixed_salary": base_fixed,
        "kpi_earned": kpi_earned,
        "advances_total": advances_total,
        "remaining": max(0, doctor_share - advances_total),
    }

