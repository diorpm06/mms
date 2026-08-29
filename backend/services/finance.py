from datetime import date, datetime

from fastapi import HTTPException
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from models.advance import Advance
from models.balance import Balance, BalanceHistory
from models.employee import Employee
from models.patient import Patient
from models.payout import Payout
from models.provider import Provider
from models.provider_advance import ProviderAdvance
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
    is_uzi: bool = False,
    original_price: int | None = None,
    provider_basis: int | None = None,
):
    """
    Financial split logic:
    - Normal services:
      - Provider base = total * provider_percentage / 100
      - Referrer amount = referrer_commission_sum or (total * referrer_percentage / 100)
      - Doctor deduction = ref_doc_split_sum or (referrer_amount * ref_doc_split_pct / 100)
      - Provider final = max(0, provider_base - doctor_deduction)
      - Center final = max(0, total - referrer_amount - provider_final)

    - UZI services (Special Rule):
      - Clinic fixed fee = 0 if (original_price and total < original_price) else 10000
      - Remaining = max(0, total - clinic_fixed_fee)
      - Provider final = int(remaining * provider_percentage / 100)
      - Referrer amount = referrer_commission_sum or (total * referrer_percentage / 100)
      - Referrer is paid 100% from clinic share (0 deduction from doctor)
      - Center final = max(0, total - referrer_amount - provider_final)
    """
    referrer_amount = 0
    if referrer_commission_sum and referrer_commission_sum > 0:
        referrer_amount = int(referrer_commission_sum)
    elif referrer_percentage:
        referrer_amount = int(total * referrer_percentage / 100)

    if is_uzi:
        has_discount = original_price is not None and total < original_price
        clinic_fixed_fee = 0 if has_discount else 10000
        remaining = max(0, total - clinic_fixed_fee)
        pct = provider_percentage if provider_percentage > 0 else 50
        provider_amount = int(remaining * pct / 100)
        center_amount = total - referrer_amount - provider_amount
        return referrer_amount, provider_amount, center_amount

    # Normal services: Direct percentage split (Doctor gets provider_percentage % of total,
    # Referrer gets referrer_percentage % or fixed sum of total, Center gets remaining)
    # provider_basis berilgan bo'lsa (masalan massaj xizmatida chegirma bo'lsa),
    # shifokor ulushi CHEGIRMASIZ asl narxdan hisoblanadi — chegirma faqat
    # klinika ulushini kamaytiradi, shifokorniki avvalgidek to'liq qoladi.
    basis = provider_basis if provider_basis is not None else total
    provider_amount = int(basis * provider_percentage / 100)
    center_amount = total - referrer_amount - provider_amount

    return referrer_amount, provider_amount, center_amount


# Komissiya qoidalari bazada saqlanadi, lekin hisobotlarda yuzlab bemor uchun
# takror o'qilmasligi kerak — shuning uchun jarayon xotirasida saqlanadi va
# sozlama o'zgarganda bekor qilinadi.
_QOIDA_KESH: dict = {"bolim": None, "istisno": None}


def invalidate_commission_cache() -> None:
    """Komissiya sozlamasi o'zgarganda chaqiriladi."""
    _QOIDA_KESH["bolim"] = None
    _QOIDA_KESH["istisno"] = None


def _load_commission_rules(db: Session):
    if _QOIDA_KESH["bolim"] is None or _QOIDA_KESH["istisno"] is None:
        from models.referrer_commission import ReferrerCommission
        from models.service_category import ServiceCategory

        _QOIDA_KESH["bolim"] = {
            (c.name or "").strip().lower(): (c.commission_mode or "none", int(c.commission_value or 0))
            for c in db.query(ServiceCategory).all()
        }
        _QOIDA_KESH["istisno"] = {
            (rc.referrer_id, (rc.category or "").strip().lower()): (rc.mode or "none", int(rc.value or 0))
            for rc in db.query(ReferrerCommission).all()
        }
    return _QOIDA_KESH["bolim"], _QOIDA_KESH["istisno"]


def main_category(raw: str | None) -> str:
    """'Laboratoriya: GORMONLAR' -> 'Laboratoriya'"""
    v = (raw or "Umumiy").strip()
    return v.split(":")[0].strip() if ":" in v else v


def get_referrer_rates_for_service(referrer, service, db: Session | None = None):
    """
    Yo'naltiruvchiga shu xizmat uchun qancha berilishini qaytaradi: (foiz, summa).

    Tartib:
      1. Xizmat komissiyadan chiqarilgan bo'lsa -> 0
      2. Shu yo'naltiruvchi uchun bo'limda istisno bor bo'lsa -> o'sha
      3. Aks holda bo'limning umumiy tarifi
      4. Bo'lim topilmasa yoki tarifi "yo'q" bo'lsa -> 0

    Qoidalar bazadan o'qiladi (rahbar panelidan boshqariladi). Ilgari bu
    yerda bo'lim nomlari va tariflar kodda yozib qo'yilgan edi.
    """
    if not referrer or not service:
        return 0, 0

    if getattr(service, "no_referrer_commission", False):
        return 0, 0

    if db is None:
        db = _sessiya_ol()
        oz_sessiyam = True
    else:
        oz_sessiyam = False

    try:
        bolimlar, istisnolar = _load_commission_rules(db)
    finally:
        if oz_sessiyam:
            db.close()

    cat_name = main_category(getattr(service, "category", None)).lower()
    svc_name = (getattr(service, "name", None) or "").lower()
    c_name = f"{cat_name} {svc_name}"

    rejim, qiymat = istisnolar.get((referrer.id, cat_name)) or bolimlar.get(cat_name) or ("none", 0)

    if rejim == "percent":
        return int(qiymat), 0
    if rejim == "sum":
        return 0, int(qiymat)
    
    # 1. Laboratoriya
    if any(k in c_name for k in [
        "labora", "tahlil", "gormon", "infeksiya", "biokimyo", "klinik",
        "koagul", "gepatit", "torch", "elektrolit", "allergiya", "revmatoid",
        "siydik", "mazok", "surtma", "oak", "vsk", "crb"
    ]):
        pct = getattr(referrer, "lab_percent", 22)
        return (pct if pct is not None and pct > 0 else 22), 0

    # 2. UZI
    if any(k in c_name for k in ["uzi", "ultratovush", "mashonka"]):
        s_val = getattr(referrer, "uzi_sum", 15000)
        return 0, (s_val if s_val is not None and s_val > 0 else 15000)

    # 3. Ozonaterapiya
    if any(k in c_name for k in ["ozon", "ozonoterap", "ozonaterap"]):
        s_val = getattr(referrer, "ozon_sum", 10000)
        return 0, (s_val if s_val is not None and s_val > 0 else 10000)

    # 4. Fizioterapiya & Massaj
    if any(k in c_name for k in [
        "fizio", "terapiya", "aktivator", "lazer", "magnit", "elektro",
        "parafin", "xijoma", "ultrazvuk", "uvch", "darsanval", "tubus",
        "limfo", "traksion", "gidro", "cho'zish", "iglo", "bochka", "massaj", "массаж"
    ]):
        pct = getattr(referrer, "fizio_percent", 20)
        return (pct if pct is not None and pct > 0 else 20), 0

    # 5. Qolgan barcha xizmatlar uchun yo'naltiruvchining umumiy yoki fizio foizini qo'llash
    gen_pct = getattr(referrer, "percentage", 0) or getattr(referrer, "fizio_percent", 20)
    if gen_pct and gen_pct > 0:
        return int(gen_pct), 0

    return 0, 0


def _sessiya_ol():
    from database import SessionLocal
    return SessionLocal()


def _split_amounts(total: int, referrer_id: int | None, provider_id: int | None, db: Session, service_id: int | None = None, discount_amount: int = 0):
    provider = None
    provider_pct = 0
    if provider_id:
        provider = db.query(Provider).filter(Provider.id == provider_id, Provider.is_active == True).first()
        if provider:
            provider_pct = provider.percentage

    referrer = None
    if referrer_id:
        referrer = db.query(Referrer).filter(Referrer.id == referrer_id, Referrer.is_active == True).first()

    from models.service import Service
    service = db.query(Service).filter(Service.id == service_id).first() if service_id else None

    ref_comm_pct, ref_comm_sum = get_referrer_rates_for_service(referrer, service, db)
    ref_doc_split_pct = service.referrer_doctor_split_percent if service else None
    ref_doc_split_sum = service.referrer_doctor_split_sum if service else 0

    if not referrer:
        ref_comm_pct = 0
        ref_comm_sum = 0

    is_uzi = main_category(service.category).lower().startswith("uzi") if service else False
    original_price = service.price if service else total

    # Massaj xizmatida chegirma berilgan bo'lsa — shifokor ulushi asl
    # (chegirmasiz) narxdan hisoblanadi, chegirma faqat klinika ulushini
    # kamaytiradi. Boshqa xizmatlarda bunday emas: chegirma hammaga
    # (klinika, shifokor, yo'naltiruvchi) proportsional ta'sir qiladi.
    provider_basis = None
    if service and discount_amount and discount_amount > 0:
        is_massage = main_category(service.category).strip().lower() == "massaj"
        if is_massage:
            provider_basis = total + discount_amount

    referrer_amount, provider_amount, center_amount = calculate_financial_split(
        total=total,
        provider_percentage=provider_pct,
        referrer_percentage=ref_comm_pct,
        referrer_commission_sum=ref_comm_sum,
        ref_doc_split_pct=ref_doc_split_pct if referrer else None,
        ref_doc_split_sum=ref_doc_split_sum if referrer else 0,
        is_uzi=is_uzi,
        original_price=original_price,
        provider_basis=provider_basis,
    )
    return provider, referrer, referrer_amount, provider_amount, center_amount


def _settle_open_advances(db: Session, recipient_type: str, recipient_id: int) -> int:
    """Balans to'liq chiqarilgandan keyin chaqiriladi: shu paytgacha berilgan
    avanslar allaqachon balansga (tot_adv orqali) hisobga olingan bo'lib,
    to'liq to'lov bilan birga "yopiladi" — aks holda ular is_settled=False
    holida qolib, KEYINGI davrda ham balansni abadiy kamaytirib turaveradi
    (xuddi hech qachon to'lanmagandek)."""
    from models.provider_advance import ProviderAdvance

    advances = (
        db.query(ProviderAdvance)
        .filter(
            ProviderAdvance.recipient_type == recipient_type,
            ProviderAdvance.recipient_id == recipient_id,
            ProviderAdvance.is_settled == False,
        )
        .all()
    )
    qoplanadi = 0
    for adv in advances:
        qoplanadi += int(adv.remaining or 0)
        adv.remaining = 0
        adv.is_settled = True
        adv.settled_at = datetime.now()
    return qoplanadi


def sync_provider_balance(db: Session, provider_id: int) -> int:
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        return 0
    tot_earned = db.query(func.coalesce(func.sum(Transaction.provider_amount), 0)).filter(
        Transaction.provider_id == provider_id, Transaction.is_cancelled == False
    ).scalar() or 0

    # DIQQAT: is_settled bo'yicha filtrlab bo'lmaydi. Avans "yopilgan" deb
    # belgilanishi payout paytida sodir bo'ladi (pastda) — agar shu yerda
    # settled avanslar hisobga olinmasa, chiqarim qilingandan keyin balans
    # xuddi avans hech qachon berilmagandek yana o'sib ketadi va ikkinchi
    # marta chiqarib olish mumkin bo'lib qoladi (avans + to'liq balans).
    tot_adv = db.query(func.coalesce(func.sum(ProviderAdvance.amount), 0)).filter(
        ProviderAdvance.recipient_type == "provider",
        ProviderAdvance.recipient_id == provider_id,
        ProviderAdvance.is_cancelled == False,
    ).scalar() or 0

    tot_payouts = db.query(func.coalesce(func.sum(Payout.amount), 0)).filter(
        Payout.recipient_type.in_(["provider", "employee"]),
        Payout.recipient_id == provider_id,
    ).scalar() or 0

    p.balance = max(0, tot_earned - tot_adv - tot_payouts)
    return p.balance


def sync_referrer_balance(db: Session, referrer_id: int) -> int:
    r = db.query(Referrer).filter(Referrer.id == referrer_id).first()
    if not r:
        return 0
    tot_earned = db.query(func.coalesce(func.sum(Transaction.referrer_amount), 0)).filter(
        Transaction.referrer_id == referrer_id, Transaction.is_cancelled == False
    ).scalar() or 0

    # is_settled bo'yicha filtrlanmaydi — providerdagi izohga qarang.
    tot_adv = db.query(func.coalesce(func.sum(ProviderAdvance.amount), 0)).filter(
        ProviderAdvance.recipient_type == "referrer",
        ProviderAdvance.recipient_id == referrer_id,
        ProviderAdvance.is_cancelled == False,
    ).scalar() or 0

    tot_payouts = db.query(func.coalesce(func.sum(Payout.amount), 0)).filter(
        Payout.recipient_type == "referrer",
        Payout.recipient_id == referrer_id,
    ).scalar() or 0

    r.balance = max(0, tot_earned - tot_adv - tot_payouts)
    return r.balance


def process_payment(db: Session, patient: Patient) -> Transaction:
    provider, referrer, referrer_amount, provider_amount, center_amount = _split_amounts(
        patient.payment_amount, patient.referrer_id, patient.provider_id, db, service_id=patient.service_id,
        discount_amount=patient.discount_amount or 0,
    )

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
    db.flush()

    # tx yuqorida db.add qilingandan KEYIN sinxronlanadi — aks holda
    # joriy to'lov Transaction jadvaliga hali kirmagan bo'lib, balans bir
    # to'lov orqada qolib ketardi.
    if referrer:
        sync_referrer_balance(db, referrer.id)
    if provider:
        sync_provider_balance(db, provider.id)

    return tx


def reprice_patient_payment(db: Session, patient: Patient, tx: Transaction) -> Transaction:
    """
    Bemor yozuvi tahrirlangandan keyin pulni qaytadan taqsimlaydi.

    Masalan yo'naltiruvchi keyinchalik qo'shilsa, uning ulushi hisoblanishi
    va balanslar to'g'rilanishi kerak. Buning uchun avvalgi taqsimot
    balanslardan ayiriladi, so'ng yangisi qo'shiladi.
    """
    # Eski markaz ulushini eslab qolamiz: kassa tarixiga YANGI summa emas,
    # HAQIQIY o'zgarish (yangi - eski) yozilishi kerak.
    eski_markaz = int(tx.center_amount or 0)
    eski_referrer_id = tx.referrer_id
    eski_provider_id = tx.provider_id

    bal = get_or_create_balance(db)

    # Yangi taqsimotni hisoblaymiz. Shifokor/yo'naltiruvchi balansini bu
    # yerda qo'lda o'zgartirmaymiz — pastda tranzaksiya yangilangandan keyin
    # sync_referrer_balance/sync_provider_balance orqali NOLDAN qayta
    # hisoblanadi, shu bilan eski va yangi taqsimot farqi avtomatik to'g'ri
    # chiqadi (hatto yo'naltiruvchi/shifokor almashtirilgan bo'lsa ham).
    provider, referrer, referrer_amount, provider_amount, center_amount = _split_amounts(
        patient.payment_amount, patient.referrer_id, patient.provider_id, db,
        service_id=patient.service_id, discount_amount=patient.discount_amount or 0,
    )

    # Tranzaksiyani yangilaymiz
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

    # DIQQAT: ilgari bu yerda `center_amount - (0)` turgan edi, ya'ni kassa
    # tarixiga yangi summaning O'ZI yozilardi. Kassa esa aslida faqat
    # (yangi - eski) ga o'zgaradi. Natijada har bir tahrirdan keyin tarix
    # eski summacha ortiqcha ko'rsatardi va "kassada pul kam" degan
    # nomutanosiblik chiqardi.
    bal.current_balance += center_amount - eski_markaz
    bal.updated_at = datetime.now()
    log_balance_change(
        db, center_amount - eski_markaz, "correction",
        f"Tahrirlandi: mijoz #{patient.id} {patient.first_name} "
        f"{patient.last_name} ({eski_markaz:,} -> {center_amount:,})",
    )

    # Shifokor/yo'naltiruvchi balansini noldan qayta hisoblaymiz — eski va
    # yangi kishi boshqa-boshqa bo'lishi mumkin, shuning uchun ikkalasi ham
    # yangilanadi.
    db.flush()
    if eski_referrer_id and eski_referrer_id != tx.referrer_id:
        sync_referrer_balance(db, eski_referrer_id)
    if tx.referrer_id:
        sync_referrer_balance(db, tx.referrer_id)
    if eski_provider_id and eski_provider_id != tx.provider_id:
        sync_provider_balance(db, eski_provider_id)
    if tx.provider_id:
        sync_provider_balance(db, tx.provider_id)

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
    for ref in db.query(Referrer).filter(Referrer.is_active == True).all():
        sync_referrer_balance(db, ref.id)
        if ref.balance <= 0:
            continue
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
        # Shu paytgacha berilgan avanslar shu to'lov bilan birga yopiladi —
        # aks holda keyingi davrda ham balansni abadiy kamaytirib turaveradi.
        _settle_open_advances(db, "referrer", ref.id)

    for prov in db.query(Provider).filter(Provider.is_active == True).all():
        sync_provider_balance(db, prov.id)
        if prov.balance <= 0:
            continue
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
        _settle_open_advances(db, "provider", prov.id)

    bal.updated_at = datetime.now()
    db.add_all(payouts)
    return payouts


def payout_recipient_balance(db: Session, recipient_type: str, recipient_id: int, source: str | None = None) -> Payout:
    today = date.today()
    if recipient_type == "referrer":
        obj = db.query(Referrer).filter(Referrer.id == recipient_id, Referrer.is_active == True).first()
    else:
        obj = db.query(Provider).filter(Provider.id == recipient_id, Provider.is_active == True).first()

    if not obj:
        raise HTTPException(status_code=400, detail="Chiqariladigan balans yo'q")

    # Balans faqat har bir to'lovda yangilanadi — agar shu oradan keyin avans
    # berilgan yoki bekor qilingan bo'lsa, saqlangan balans eskirgan bo'lishi
    # mumkin. Chiqarim oldidan har doim yangidan hisoblab olamiz.
    if recipient_type == "referrer":
        sync_referrer_balance(db, recipient_id)
    else:
        sync_provider_balance(db, recipient_id)

    if not obj or obj.balance <= 0:
        raise HTTPException(status_code=400, detail="Chiqariladigan balans yo'q")

    # obj.balance sync_provider_balance/sync_referrer_balance orqali hisoblanadi
    # va u allaqachon barcha olingan avanslarni TO'LIQ ayirib tashlagan holda
    # keladi (Jami Ishlangan - Avanslar - Oldingi To'lovlar). Shuning uchun bu
    # yerda avansni yana bir marta ayirish KERAK EMAS — aks holda avans ikki
    # marta ayrilib, odamga kam pul chiqadi. Bu yerda faqat hali "yopilgan"
    # deb belgilanmagan avanslarni yopilgan deb belgilaymiz — sof shunchaki
    # buxgalteriya uchun (boshqa joylarda "avans qarzi" noto'g'ri ko'rinib
    # qolmasligi uchun), pul hisobiga ta'sir qilmaydi.
    beriladi = int(obj.balance)
    qoplanadi = _settle_open_advances(db, recipient_type, recipient_id)

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
        log_balance_change(db, 0, "advance_settle", f"Avans yopildi (hisobda edi): {who} — {qoplanadi:,} so'm")
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
    if patient.is_cancelled or (tx and tx.is_cancelled):
        return
    provider = db.query(Provider).filter(Provider.id == tx.provider_id).first() if tx.provider_id else None
    if tx.referrer_id:
        ref = db.query(Referrer).filter(Referrer.id == tx.referrer_id).first()
        if ref:
            ref.balance = max(0, ref.balance - (tx.referrer_amount or 0))
    if provider:
        provider.balance = max(0, provider.balance - (tx.provider_amount or 0))
    bal = get_or_create_balance(db)
    bal.current_balance = max(0, bal.current_balance - (tx.center_amount or 0))
    bal.updated_at = datetime.now()
    log_balance_change(db, -(tx.center_amount or 0), "cancel", f"Bekor/O'chirish: mijoz #{patient.id}")
    tx.is_cancelled = True
    tx.cancelled_at = datetime.now()
    tx.cancel_reason = patient.cancel_reason or "Bekor qilindi"


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
    cash_amount: int | None = None,
    card_amount: int | None = None,
    click_amount: int | None = None,
    qr_amount: int | None = None,
) -> Transaction:
    """Statsionarda to'lov qabul qilish va bo'limlar bo'yicha to'g'ri taqsimlash."""
    # Active items (extra services & materials)
    active_items = [it for it in (inpatient.items or []) if not getattr(it, "is_cancelled", False)]
    extra_items = [it for it in active_items if not (it.is_included_in_tariff or it.is_no_charge)]
    
    extra_total = sum(it.total_price for it in extra_items)
    
    # If the payment covers extra services, split extra items to their respective providers
    if extra_items and amount > 0 and amount >= extra_total:
        room_amount = amount - extra_total

        # "Keyinroq" (nasiya/qarz) bo'lsa hech qanday pul kelmagan — naqd,
        # click, qr yoki karta deb yozib bo'lmaydi. Ilgari bu yerda
        # payment_type umuman tekshirilmasdi: naqddan qolgan HAMMASI
        # avtomatik "karta" deb yozilardi — nasiya bo'lsa ham, Click yoki
        # QR orqali to'langan bo'lsa ham xuddi shunday xato bo'lardi.
        ptype = (payment_type or "cash").lower()
        is_later = ptype in ("later", "keyinroq", "nasiya", "qarz")

        # Chaqiruvchi (masalan kunlik to'lov formasi) faqat to'lov turini
        # yuborib, ichki naqd/karta/click/qr taqsimotini bermasligi mumkin
        # — bunda to'liq summani to'lov turiga mos ustunga o'zimiz yozamiz.
        no_breakdown = cash_amount is None and card_amount is None and click_amount is None and qr_amount is None
        if no_breakdown and not is_later:
            if ptype in ("cash", "naqd"):
                cash_amount = amount
            elif ptype in ("click", "payme"):
                click_amount = amount
            elif ptype == "qr":
                qr_amount = amount
            else:
                card_amount = amount

        c_left = 0 if is_later else (cash_amount or 0)
        cl_left = 0 if is_later else (click_amount or 0)
        q_left = 0 if is_later else (qr_amount or 0)

        def _taqsimla(kerak: int):
            """Berilgan summadan qancha naqd/click/qr/karta bo'lib olinishini
            hisoblaydi: avval naqd, keyin click, keyin qr, qolgani karta."""
            nonlocal c_left, cl_left, q_left
            c = min(c_left, kerak); c_left -= c; kerak -= c
            cl = min(cl_left, kerak); cl_left -= cl; kerak -= cl
            q = min(q_left, kerak); q_left -= q; kerak -= q
            return c, cl, q, kerak  # oxirgisi — karta

        # 1. Main Statsionar Transaction (Palata & Room daily rate)
        if room_amount > 0 or not extra_items:
            bal = get_or_create_balance(db)
            bal.current_balance += room_amount
            bal.updated_at = datetime.now()
            log_balance_change(
                db, room_amount, "income",
                f"Yotgan #{inpatient.id} (Palata): {inpatient.first_name} {inpatient.last_name}",
            )

            if is_later:
                c_amt = cl_amt = q_amt = cd_amt = 0
            else:
                c_amt, cl_amt, q_amt, cd_amt = _taqsimla(room_amount)

            tx_main = Transaction(
                patient_id=None,
                inpatient_id=inpatient.id,
                total_amount=room_amount,
                referrer_id=None,
                referrer_amount=0,
                provider_id=None,
                provider_amount=0,
                center_amount=room_amount,
                payment_type=payment_type,
                cash_amount=c_amt,
                card_amount=cd_amt,
                click_amount=cl_amt,
                qr_amount=q_amt,
            )
            db.add(tx_main)

        # 2. Add individual transactions for each extra service/material
        for it in extra_items:
            it_amt = it.total_price
            if it_amt <= 0:
                continue

            prov, ref, r_amt, p_amt, c_amt_calc = _split_amounts(
                it_amt, inpatient.referrer_id, None, db, service_id=it.service_id
            )
            
            # Match provider by service category or specialization if available
            if not prov and it.service_id:
                from models.service import Service
                svc = db.query(Service).filter(Service.id == it.service_id).first()
                if svc and svc.category:
                    cat_name = main_category(svc.category).lower()
                    if "ozon" in cat_name:
                        prov = db.query(Provider).filter(Provider.specialization.ilike("%ozon%"), Provider.is_active == True).first()
                    elif "uzi" in cat_name:
                        prov = db.query(Provider).filter(Provider.specialization.ilike("%uzi%"), Provider.is_active == True).first()
                    elif "labora" in cat_name or "tahlil" in cat_name:
                        prov = db.query(Provider).filter(Provider.specialization.ilike("%labora%"), Provider.is_active == True).first()
            
            bal = get_or_create_balance(db)
            bal.current_balance += c_amt_calc
            bal.updated_at = datetime.now()
            log_balance_change(
                db, c_amt_calc, "income",
                f"Yotgan #{inpatient.id} ({it.name}): {inpatient.first_name} {inpatient.last_name}",
            )

            if is_later:
                item_cash = item_click = item_qr = item_card = 0
                item_ptype = payment_type
            else:
                item_cash, item_click, item_qr, item_card = _taqsimla(it_amt)
                if item_cash == it_amt:
                    item_ptype = "cash"
                elif item_click == it_amt:
                    item_ptype = "click"
                elif item_qr == it_amt:
                    item_ptype = "qr"
                elif item_card == it_amt:
                    item_ptype = "card"
                else:
                    item_ptype = "split"

            tx_item = Transaction(
                patient_id=None,
                inpatient_id=inpatient.id,
                total_amount=it_amt,
                referrer_id=ref.id if ref else None,
                referrer_amount=r_amt,
                provider_id=prov.id if prov else None,
                provider_amount=p_amt,
                center_amount=c_amt_calc,
                payment_type=item_ptype,
                cash_amount=item_cash,
                card_amount=item_card,
                click_amount=item_click,
                qr_amount=item_qr,
            )
            db.add(tx_item)
            db.flush()
            if prov and p_amt > 0:
                sync_provider_balance(db, prov.id)
            if ref and r_amt > 0:
                sync_referrer_balance(db, ref.id)

        return tx_main if (room_amount > 0 or not extra_items) else tx_item

    # Fallback standard lump-sum handling
    referrer_amount = 0
    provider_amount = 0
    center_amount = amount
    bal = get_or_create_balance(db)
    bal.current_balance += center_amount
    bal.updated_at = datetime.now()
    log_balance_change(
        db, center_amount, "income",
        f"Yotgan #{inpatient.id}: {inpatient.first_name} {inpatient.last_name}",
    )

    c_amt = cash_amount or 0
    cd_amt = card_amount or 0
    cl_amt = click_amount or 0
    q_amt = qr_amount or 0

    if (payment_type or "").lower() in ("split", "aralash") and (c_amt + cd_amt + cl_amt + q_amt > 0):
        pass
    else:
        ptype = (payment_type or "").lower()
        if ptype in ("cash", "naqd"):
            c_amt = amount
        elif ptype in ("click", "payme"):
            cl_amt = amount
        elif ptype == "qr":
            q_amt = amount
        elif ptype in ("later", "keyinroq", "nasiya", "qarz"):
            c_amt = cd_amt = cl_amt = q_amt = 0
        else:
            cd_amt = amount

    tx = Transaction(
        patient_id=None,
        inpatient_id=inpatient.id,
        total_amount=amount,
        referrer_id=None,
        referrer_amount=referrer_amount,
        provider_id=inpatient.doctor_id,
        provider_amount=provider_amount,
        center_amount=center_amount,
        payment_type=payment_type,
        cash_amount=c_amt,
        card_amount=cd_amt,
        click_amount=cl_amt,
        qr_amount=q_amt,
    )
    db.add(tx)
    return tx


def cancel_inpatient_payments(db: Session, inpatient: Inpatient, sabab: str | None = None) -> int:
    """Yotgan bemor bekor qilinganda olingan pullarni kassadan qaytaradi.

    Ilgari bunday funksiya umuman yo'q edi: bemor bekor qilinsa ham olingan
    to'lov kassada va kunlik tushum hisobotida qolib ketardi.
    Qaytarilgan umumiy summani qaytaradi.
    """
    from models.inpatient import InpatientPayment

    tranzaksiyalar = (
        db.query(Transaction)
        .filter(Transaction.inpatient_id == inpatient.id, Transaction.is_cancelled == False)  # noqa: E712
        .all()
    )
    if not tranzaksiyalar:
        return 0

    bal = get_or_create_balance(db)
    jami = 0
    for tx in tranzaksiyalar:
        if tx.referrer_id:
            ref = db.query(Referrer).filter(Referrer.id == tx.referrer_id).first()
            if ref:
                ref.balance = max(0, int(ref.balance or 0) - int(tx.referrer_amount or 0))
        if tx.provider_id and (tx.provider_amount or 0):
            prov = db.query(Provider).filter(Provider.id == tx.provider_id).first()
            if prov:
                prov.balance = max(0, int(prov.balance or 0) - int(tx.provider_amount or 0))

        bal.current_balance = max(0, int(bal.current_balance or 0) - int(tx.center_amount or 0))
        jami += int(tx.total_amount or 0)

        tx.is_cancelled = True
        tx.cancelled_at = datetime.now()
        tx.cancel_reason = sabab or "Yotgan bemor bekor qilindi"

    bal.updated_at = datetime.now()
    log_balance_change(
        db, -jami, "cancel",
        f"Statsionar bekor: #{inpatient.id} {inpatient.first_name} {inpatient.last_name}",
    )

    # To'lov yozuvlari ham bekor qilinadi — aks holda bemor kartasida
    # "to'langan" bo'lib turaveradi
    for pay in db.query(InpatientPayment).filter(
        InpatientPayment.inpatient_id == inpatient.id,
        InpatientPayment.is_cancelled == False,  # noqa: E712
    ).all():
        pay.is_cancelled = True
        pay.cancelled_at = datetime.now()
        pay.cancel_reason = sabab or "Yotgan bemor bekor qilindi"

    return jami
