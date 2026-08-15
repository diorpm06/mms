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

# To'lov turlari bir joyda. Tizimda tarixan ikki xil atama ishlatilgan
# (ingliz "cash/card" va o'zbek "naqd/karta"), shuning uchun har bir modul
# o'zicha ro'yxat tuzib, ba'zilari (masalan click, qr) hisobdan tushib
# qolardi. Yangi to'lov turi qo'shilsa — faqat shu yerga qo'shiladi.
CASH_TYPES = ("cash", "naqd")
CARD_TYPES = ("card", "karta", "click", "payme", "qr", "terminal")
LATER_TYPES = ("later", "keyinroq", "nasiya", "qarz")
SPLIT_TYPES = ("split", "aralash")


def get_or_create_balance(db: Session) -> Balance:
    bal = db.query(Balance).first()
    if not bal:
        bal = Balance(current_balance=0)
        db.add(bal)
        db.flush()
    return bal


def log_balance_change(db: Session, amount: int, entry_type: str, description: str):
    db.add(BalanceHistory(amount=amount, entry_type=entry_type, description=description))


def calculate_financial_split(
    total: int,
    provider_percentage: int,
    referrer_percentage: int | None = None,
    referrer_commission_sum: int | None = 0,
    ref_doc_split_pct: int | None = None,
    ref_doc_split_sum: int | None = 0,
):
    """
    Financial split logic:
    - Provider (Doctor) base = total * provider_percentage / 100
    - Referrer amount = referrer_commission_sum or (total * referrer_percentage / 100)
    - Doctor deduction = ref_doc_split_sum or (referrer_amount * ref_doc_split_pct / 100)
    - Provider final = max(0, provider_base - doctor_deduction)
    - Center final = max(0, total - referrer_amount - provider_final)
    """
    provider_base = int(total * provider_percentage / 100)

    referrer_amount = 0
    if referrer_commission_sum and referrer_commission_sum > 0:
        referrer_amount = int(referrer_commission_sum)
    elif referrer_percentage:
        referrer_amount = int(total * referrer_percentage / 100)

    ref_doc_deduction = 0
    if referrer_amount > 0:
        if ref_doc_split_sum and ref_doc_split_sum > 0:
            ref_doc_deduction = int(ref_doc_split_sum)
        elif ref_doc_split_pct is not None and ref_doc_split_pct > 0:
            ref_doc_deduction = int((referrer_amount * ref_doc_split_pct) / 100)

    provider_amount = max(0, provider_base - ref_doc_deduction)
    center_amount = max(0, total - referrer_amount - provider_amount)

    return referrer_amount, provider_amount, center_amount


def _split_amounts(total: int, referrer_id: int | None, provider_id: int | None, db: Session, service_id: int | None = None):
    provider = None
    provider_pct = 0
    if provider_id:
        provider = db.query(Provider).filter(Provider.id == provider_id, Provider.is_active == True).first()
        if provider:
            provider_pct = provider.percentage

    referrer = None
    referrer_pct = None
    if referrer_id:
        referrer = db.query(Referrer).filter(Referrer.id == referrer_id, Referrer.is_active == True).first()
        if referrer:
            referrer_pct = referrer.percentage

    from models.service import Service
    service = db.query(Service).filter(Service.id == service_id).first() if service_id else None

    ref_comm_sum = service.referrer_commission_sum if service else 0
    ref_comm_pct = service.referrer_commission_percent if (service and service.referrer_commission_percent) else 0
    ref_doc_split_pct = service.referrer_doctor_split_percent if service else None
    ref_doc_split_sum = service.referrer_doctor_split_sum if service else 0

    # DIQQAT: yo'naltiruvchi ko'rsatilmagan bo'lsa komissiya umuman
    # hisoblanmasligi kerak. Ilgari komissiya xizmat sozlamasidan olinib,
    # yo'naltiruvchi yo'q bo'lsa ham klinika ulushidan ayirilardi va hech
    # kimga berilmasdi — pul yo'qolib ketardi.
    if not referrer:
        ref_comm_pct = 0
        ref_comm_sum = 0

    referrer_amount, provider_amount, center_amount = calculate_financial_split(
        total=total,
        provider_percentage=provider_pct,
        referrer_percentage=ref_comm_pct,
        referrer_commission_sum=ref_comm_sum,
        ref_doc_split_pct=ref_doc_split_pct if referrer else None,
        ref_doc_split_sum=ref_doc_split_sum if referrer else 0,
    )
    return provider, referrer, referrer_amount, provider_amount, center_amount


def process_payment(db: Session, patient: Patient) -> Transaction:
    provider, referrer, referrer_amount, provider_amount, center_amount = _split_amounts(
        patient.payment_amount, patient.referrer_id, patient.provider_id, db, service_id=patient.service_id
    )

    if referrer:
        referrer.balance += referrer_amount
    if provider:
        provider.balance += provider_amount

    bal = get_or_create_balance(db)
    bal.current_balance += center_amount
    bal.updated_at = datetime.now()

    log_balance_change(
        db,
        center_amount,
        "income",
        f"Mijoz #{patient.id}: {patient.first_name} {patient.last_name}",
    )

    tx = Transaction(
        patient_id=patient.id,
        total_amount=patient.payment_amount,
        referrer_id=patient.referrer_id,
        referrer_amount=referrer_amount,
        provider_id=provider.id if provider else None,
        provider_amount=provider_amount,
        center_amount=center_amount,
        payment_type=patient.payment_type,
        cash_amount=patient.cash_amount or 0,
        click_amount=patient.click_amount or 0,
        qr_amount=patient.qr_amount or 0,
        card_amount=patient.card_amount or 0,
        created_at=patient.created_at or datetime.now(),
    )
    db.add(tx)
    return tx


def reprice_patient_payment(db: Session, patient: Patient, tx: Transaction) -> Transaction:
    """
    Bemor yozuvi tahrirlangandan keyin pulni qaytadan taqsimlaydi.

    Masalan yo'naltiruvchi keyinchalik qo'shilsa, uning ulushi hisoblanishi
    va balanslar to'g'rilanishi kerak. Buning uchun avvalgi taqsimot
    balanslardan ayiriladi, so'ng yangisi qo'shiladi.
    """
    # 1) Eski taqsimotni orqaga qaytaramiz
    if tx.referrer_id:
        old_ref = db.query(Referrer).filter(Referrer.id == tx.referrer_id).first()
        if old_ref:
            old_ref.balance = max(0, old_ref.balance - (tx.referrer_amount or 0))
    if tx.provider_id:
        old_prov = db.query(Provider).filter(Provider.id == tx.provider_id).first()
        if old_prov:
            old_prov.balance = max(0, old_prov.balance - (tx.provider_amount or 0))

    bal = get_or_create_balance(db)
    bal.current_balance = max(0, bal.current_balance - (tx.center_amount or 0))

    # 2) Yangi taqsimotni hisoblaymiz
    provider, referrer, referrer_amount, provider_amount, center_amount = _split_amounts(
        patient.payment_amount, patient.referrer_id, patient.provider_id, db,
        service_id=patient.service_id,
    )
    if referrer:
        referrer.balance += referrer_amount
    if provider:
        provider.balance += provider_amount
    bal.current_balance += center_amount
    bal.updated_at = datetime.now()

    # 3) Tranzaksiyani yangilaymiz
    tx.total_amount = patient.payment_amount
    tx.referrer_id = patient.referrer_id
    tx.referrer_amount = referrer_amount
    tx.provider_id = provider.id if provider else None
    tx.provider_amount = provider_amount
    tx.center_amount = center_amount
    tx.payment_type = patient.payment_type
    tx.cash_amount = patient.cash_amount or 0
    tx.click_amount = patient.click_amount or 0
    tx.qr_amount = patient.qr_amount or 0
    tx.card_amount = patient.card_amount or 0

    log_balance_change(
        db, center_amount - (0), "correction",
        f"Tahrirlandi: mijoz #{patient.id} {patient.first_name} {patient.last_name}",
    )
    return tx


def process_expense(db: Session, amount: int, description: str) -> Balance:
    bal = get_or_create_balance(db)
    bal.current_balance -= amount
    bal.updated_at = datetime.now()
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

    bal.updated_at = datetime.now()
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

    # Oldin berilgan avanslar birinchi navbatda qoplanadi. Ilgari bu hisobga
    # olinmasdi: avans olgan shifokorga balansi TO'LIQ yana to'lanardi, ya'ni
    # klinika bir ishni ikki marta to'lardi. (Xodimlarda bu to'g'ri ishlaydi.)
    from models.provider_advance import ProviderAdvance

    advances = (
        db.query(ProviderAdvance)
        .filter(
            ProviderAdvance.recipient_type == recipient_type,
            ProviderAdvance.recipient_id == recipient_id,
            ProviderAdvance.is_settled == False,
        )
        .order_by(ProviderAdvance.created_at.asc())
        .all()
    )

    ishlagani = int(obj.balance)
    qoplanadi = 0
    qoldiq = ishlagani
    for adv in advances:
        if qoldiq <= 0:
            break
        ayiriladi = min(qoldiq, int(adv.remaining or 0))
        if ayiriladi <= 0:
            continue
        adv.remaining = int(adv.remaining) - ayiriladi
        if adv.remaining <= 0:
            adv.remaining = 0
            adv.is_settled = True
            adv.settled_at = datetime.now()
        qoplanadi += ayiriladi
        qoldiq -= ayiriladi

    beriladi = max(0, ishlagani - qoplanadi)

    bal = get_or_create_balance(db)
    if bal.current_balance < beriladi:
        raise HTTPException(status_code=400, detail="Balans yetarli emas")

    payout = Payout(
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        amount=beriladi,
        period_start=today,
        period_end=today,
    )
    source_label = source or "Manba ko'rsatilmagan"
    who = f"yo'naltiruvchi #{recipient_id}" if recipient_type == "referrer" else f"provider #{recipient_id}"
    if beriladi > 0:
        bal.current_balance -= beriladi
        bal.updated_at = datetime.now()
        log_balance_change(db, -beriladi, "payout", f"Qo'lda chiqarim ({source_label}): {who}")
    if qoplanadi > 0:
        # Pul chiqmaydi — faqat avans qarzi yopiladi, shuning uchun kassa yozuvi yo'q
        log_balance_change(db, 0, "advance_settle", f"Avansdan qoplandi: {who} — {qoplanadi:,} so'm")
    obj.balance = 0
    db.add(payout)
    payout.settled_from_advance = qoplanadi  # javobda ko'rsatish uchun (bazaga yozilmaydi)
    return payout


def process_monthly_salaries(db: Session) -> list[SalaryLog]:
    bal = get_or_create_balance(db)
    month = datetime.now().strftime("%Y-%m")
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

    bal.updated_at = datetime.now()
    return logs


def pay_employee_salary(db: Session, employee_id: int) -> SalaryLog:
    emp = db.query(Employee).filter(Employee.id == employee_id, Employee.is_active == True).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    bal = get_or_create_balance(db)
    month = datetime.now().strftime("%Y-%m")
    adv_total = _employee_advances_total_for_month(db, emp.id, month)
    payout_amount = max(0, emp.monthly_salary - adv_total)
    if bal.current_balance < payout_amount:
        raise HTTPException(status_code=400, detail="Balans yetarli emas")
    bal.current_balance -= payout_amount
    bal.updated_at = datetime.now()
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
    m = month or datetime.now().strftime("%Y-%m")
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
    bal.updated_at = datetime.now()
    log_balance_change(db, -tx.center_amount, "cancel", f"Bekor: mijoz #{patient.id}")
    tx.is_cancelled = True
    tx.cancelled_at = datetime.now()
    tx.cancel_reason = patient.cancel_reason


def process_advance(db: Session, amount: int, description: str) -> Balance:
    bal = get_or_create_balance(db)
    if bal.current_balance < amount:
        raise HTTPException(status_code=400, detail="Balans yetarli emas")
    bal.current_balance -= amount
    bal.updated_at = datetime.now()
    log_balance_change(db, -amount, "advance", description)
    return bal


def cancel_advance(db: Session, amount: int) -> Balance:
    bal = get_or_create_balance(db)
    bal.current_balance += amount
    bal.updated_at = datetime.now()
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
    bal.updated_at = datetime.now()
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
