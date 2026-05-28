from datetime import date, datetime

from fastapi import HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session

from models.advance import Advance
from models.balance import Balance, BalanceHistory
from models.employee import Employee
from models.patient import Patient
from models.payout import Payout
from models.provider import Provider
from models.referrer import Referrer
from models.salary_log import SalaryLog
from models.transaction import Transaction
from models.inpatient import Inpatient


def get_or_create_balance(db: Session) -> Balance:
    bal = db.query(Balance).first()
    if not bal:
        bal = Balance(current_balance=0)
        db.add(bal)
        db.flush()
    return bal


def log_balance_change(db: Session, amount: int, entry_type: str, description: str):
    db.add(BalanceHistory(amount=amount, entry_type=entry_type, description=description))


def process_payment(db: Session, patient: Patient) -> Transaction:
    provider = db.query(Provider).filter(Provider.id == patient.provider_id, Provider.is_active == True).first()
    if not provider:
        raise HTTPException(status_code=400, detail="Xizmat ko'rsatuvchi topilmadi")

    total = patient.payment_amount
    referrer = None
    referrer_amount = 0

    if patient.referrer_id:
        referrer = db.query(Referrer).filter(
            Referrer.id == patient.referrer_id, Referrer.is_active == True
        ).first()
        if referrer:
            referrer_amount = int(total * referrer.percentage / 100)

    provider_amount = int(total * provider.percentage / 100)
    center_amount = total - referrer_amount - provider_amount

    if center_amount < 0:
        raise HTTPException(status_code=400, detail="Foizlar jami 100% dan oshib ketdi")

    if referrer:
        referrer.balance += referrer_amount
    provider.balance += provider_amount

    bal = get_or_create_balance(db)
    bal.current_balance += center_amount
    bal.updated_at = datetime.utcnow()

    log_balance_change(
        db,
        center_amount,
        "income",
        f"Mijoz #{patient.id}: {patient.first_name} {patient.last_name}",
    )

    tx = Transaction(
        patient_id=patient.id,
        total_amount=total,
        referrer_id=patient.referrer_id,
        referrer_amount=referrer_amount,
        provider_id=provider.id,
        provider_amount=provider_amount,
        center_amount=center_amount,
        payment_type=patient.payment_type,
    )
    db.add(tx)
    return tx


def process_expense(db: Session, amount: int, description: str) -> Balance:
    bal = get_or_create_balance(db)
    if bal.current_balance < amount:
        raise HTTPException(status_code=400, detail="Balans yetarli emas")
    bal.current_balance -= amount
    bal.updated_at = datetime.utcnow()
    log_balance_change(db, -amount, "expense", description)
    return bal


def process_ten_day_payouts(db: Session, period_start: date, period_end: date) -> list[Payout]:
    bal = get_or_create_balance(db)
    payouts = []
    for ref in db.query(Referrer).filter(Referrer.is_active == True, Referrer.balance > 0).all():
        if bal.current_balance < ref.balance:
            raise ValueError("10 kunlik chiqarim uchun balans yetarli emas")
        payouts.append(
            Payout(
                recipient_type="referrer",
                recipient_id=ref.id,
                amount=ref.balance,
                period_start=period_start,
                period_end=period_end,
            )
        )
        bal.current_balance -= ref.balance
        log_balance_change(db, -ref.balance, "payout", f"10 kunlik: yo'naltiruvchi {ref.full_name}")
        ref.balance = 0

    for prov in db.query(Provider).filter(Provider.is_active == True, Provider.balance > 0).all():
        if bal.current_balance < prov.balance:
            raise ValueError("10 kunlik chiqarim uchun balans yetarli emas")
        payouts.append(
            Payout(
                recipient_type="provider",
                recipient_id=prov.id,
                amount=prov.balance,
                period_start=period_start,
                period_end=period_end,
            )
        )
        bal.current_balance -= prov.balance
        log_balance_change(db, -prov.balance, "payout", f"10 kunlik: provider {prov.full_name}")
        prov.balance = 0

    bal.updated_at = datetime.utcnow()
    db.add_all(payouts)
    return payouts


def payout_recipient_balance(db: Session, recipient_type: str, recipient_id: int, source: str | None = None) -> Payout:
    today = date.today()
    if recipient_type == "referrer":
        obj = db.query(Referrer).filter(Referrer.id == recipient_id, Referrer.is_active == True).first()
    else:
        obj = db.query(Provider).filter(Provider.id == recipient_id, Provider.is_active == True).first()

    if not obj or obj.balance <= 0:
        raise HTTPException(status_code=400, detail="Chiqariladigan balans yo'q")

    bal = get_or_create_balance(db)
    if bal.current_balance < obj.balance:
        raise HTTPException(status_code=400, detail="Balans yetarli emas")

    payout = Payout(
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        amount=obj.balance,
        period_start=today,
        period_end=today,
    )
    bal.current_balance -= obj.balance
    bal.updated_at = datetime.utcnow()
    source_label = source or "Manba ko'rsatilmagan"
    who = f"yo'naltiruvchi #{recipient_id}" if recipient_type == "referrer" else f"provider #{recipient_id}"
    log_balance_change(db, -obj.balance, "payout", f"Qo'lda chiqarim ({source_label}): {who}")
    obj.balance = 0
    db.add(payout)
    return payout


def process_monthly_salaries(db: Session) -> list[SalaryLog]:
    bal = get_or_create_balance(db)
    month = datetime.utcnow().strftime("%Y-%m")
    logs = []
    total_salary = 0

    employees = db.query(Employee).filter(Employee.is_active == True).all()
    for emp in employees:
        adv_total = _employee_advances_total_for_month(db, emp.id, month)
        total_salary += max(0, emp.monthly_salary - adv_total)

    if bal.current_balance < total_salary:
        raise ValueError("Oylik maosh uchun balans yetarli emas")

    for emp in employees:
        adv_total = _employee_advances_total_for_month(db, emp.id, month)
        payout_amount = max(0, emp.monthly_salary - adv_total)
        bal.current_balance -= payout_amount
        log = SalaryLog(employee_id=emp.id, amount=payout_amount, month=month)
        db.add(log)
        logs.append(log)
        log_balance_change(
            db,
            -payout_amount,
            "salary",
            f"{emp.full_name} — {month} (oylik {emp.monthly_salary}, avans {adv_total})",
        )

    bal.updated_at = datetime.utcnow()
    return logs


def pay_employee_salary(db: Session, employee_id: int) -> SalaryLog:
    emp = db.query(Employee).filter(Employee.id == employee_id, Employee.is_active == True).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    bal = get_or_create_balance(db)
    month = datetime.utcnow().strftime("%Y-%m")
    adv_total = _employee_advances_total_for_month(db, emp.id, month)
    payout_amount = max(0, emp.monthly_salary - adv_total)
    if bal.current_balance < payout_amount:
        raise HTTPException(status_code=400, detail="Balans yetarli emas")
    bal.current_balance -= payout_amount
    bal.updated_at = datetime.utcnow()
    log = SalaryLog(employee_id=emp.id, amount=payout_amount, month=month)
    db.add(log)
    log_balance_change(
        db,
        -payout_amount,
        "salary",
        f"{emp.full_name} — qo'lda (oylik {emp.monthly_salary}, avans {adv_total})",
    )
    return log


def _employee_advances_total_for_month(db: Session, employee_id: int, month: str) -> int:
    year, mon = month.split("-")
    total = (
        db.query(Advance)
        .filter(
            Advance.employee_id == employee_id,
            Advance.is_cancelled == False,
            extract("year", Advance.created_at) == int(year),
            extract("month", Advance.created_at) == int(mon),
        )
        .all()
    )
    return int(sum(a.amount for a in total))


def employee_payroll_summary(db: Session, employee_id: int, month: str | None = None) -> dict:
    m = month or datetime.utcnow().strftime("%Y-%m")
    year, mon = m.split("-")
    advances = (
        db.query(Advance)
        .filter(
            Advance.employee_id == employee_id,
            Advance.is_cancelled == False,
            extract("year", Advance.created_at) == int(year),
            extract("month", Advance.created_at) == int(mon),
        )
        .order_by(Advance.created_at.asc())
        .all()
    )
    adv_total = int(sum(a.amount for a in advances))
    emp = db.query(Employee).filter(Employee.id == employee_id, Employee.is_active == True).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    base = int(emp.monthly_salary)
    payable = max(0, base - adv_total)
    return {
        "month": m,
        "base_salary": base,
        "advances_total": adv_total,
        "payable_salary": payable,
        "remaining_after_salary": max(0, payable),
        "advances": [
            {
                "id": a.id,
                "amount": int(a.amount),
                "created_at": a.created_at.isoformat(),
                "note": a.note,
            }
            for a in advances
        ],
    }


def _split_amounts(total: int, referrer_id: int | None, provider_id: int, db: Session):
    provider = db.query(Provider).filter(Provider.id == provider_id, Provider.is_active == True).first()
    if not provider:
        raise HTTPException(status_code=400, detail="Xizmat ko'rsatuvchi topilmadi")
    referrer_amount = 0
    referrer = None
    if referrer_id:
        referrer = db.query(Referrer).filter(Referrer.id == referrer_id, Referrer.is_active == True).first()
        if referrer:
            referrer_amount = int(total * referrer.percentage / 100)
    provider_amount = int(total * provider.percentage / 100)
    center_amount = total - referrer_amount - provider_amount
    if center_amount < 0:
        raise HTTPException(status_code=400, detail="Foizlar jami 100% dan oshib ketdi")
    return provider, referrer, referrer_amount, provider_amount, center_amount


def cancel_patient_payment(db: Session, patient: Patient, tx: Transaction) -> None:
    if patient.is_cancelled:
        raise HTTPException(status_code=400, detail="Allaqachon bekor qilingan")
    provider = db.query(Provider).filter(Provider.id == tx.provider_id).first()
    if tx.referrer_id:
        ref = db.query(Referrer).filter(Referrer.id == tx.referrer_id).first()
        if ref:
            ref.balance = max(0, ref.balance - tx.referrer_amount)
    if provider:
        provider.balance = max(0, provider.balance - tx.provider_amount)
    bal = get_or_create_balance(db)
    bal.current_balance = max(0, bal.current_balance - tx.center_amount)
    bal.updated_at = datetime.utcnow()
    log_balance_change(db, -tx.center_amount, "cancel", f"Bekor: mijoz #{patient.id}")
    tx.is_cancelled = True
    tx.cancelled_at = datetime.utcnow()
    tx.cancel_reason = patient.cancel_reason


def process_advance(db: Session, amount: int, description: str) -> Balance:
    bal = get_or_create_balance(db)
    if bal.current_balance < amount:
        raise HTTPException(status_code=400, detail="Balans yetarli emas")
    bal.current_balance -= amount
    bal.updated_at = datetime.utcnow()
    log_balance_change(db, -amount, "advance", description)
    return bal


def cancel_advance(db: Session, amount: int) -> Balance:
    bal = get_or_create_balance(db)
    bal.current_balance += amount
    bal.updated_at = datetime.utcnow()
    log_balance_change(db, amount, "advance_cancel", "Avans bekor qilindi")
    return bal


def process_inpatient_payment(
    db: Session,
    inpatient: Inpatient,
    amount: int,
    payment_type: str,
    days_count: int,
) -> Transaction:
    provider, referrer, referrer_amount, provider_amount, center_amount = _split_amounts(
        amount, inpatient.referrer_id, inpatient.doctor_id, db
    )
    if referrer:
        referrer.balance += referrer_amount
    provider.balance += provider_amount
    bal = get_or_create_balance(db)
    bal.current_balance += center_amount
    bal.updated_at = datetime.utcnow()
    log_balance_change(
        db, center_amount, "income",
        f"Yotgan #{inpatient.id}: {inpatient.first_name} {inpatient.last_name}",
    )
    tx = Transaction(
        patient_id=None,
        total_amount=amount,
        referrer_id=inpatient.referrer_id,
        referrer_amount=referrer_amount,
        provider_id=provider.id,
        provider_amount=provider_amount,
        center_amount=center_amount,
        payment_type=payment_type,
    )
    db.add(tx)
    return tx
