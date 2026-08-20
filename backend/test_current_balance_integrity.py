# --- QALQON: JONLI BAZAGA ULANISHNI TAQIQLAYDI -------------------------
# 2026-08-20: bu skript qalqonsiz edi va jonli bazaga ulanardi. Bundan
# tashqari JONLI BAZADAGI aniq bemorga (ID 548) bog'langan edi — o'sha
# yozuv o'chsa yoki boshqa bazada ishlatilsa doim yiqilardi. Endi o'zi
# nasiya bemor yaratib, kassa balansi qimirlamaganini tekshiradi.
import os as _os
import sys as _sys
if not _os.environ.get("DATABASE_URL", "").startswith("sqlite"):
    _sys.exit("TO'XTATILDI: test skripti jonli bazada ishlamaydi. "
              "DATABASE_URL sqlite:/// bilan boshlanishi shart.")
# ----------------------------------------------------------------------

import sys, io, uuid
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.service import Service
from models.transaction import Transaction
from services.finance import get_or_create_balance

db = SessionLocal()

print("=== NASIYA TO'LOV KASSAGA TEGMASLIGI TEKSHIRUVI ===")

svc = db.query(Service).filter(Service.is_active == True).first()
assert svc, "Bazada faol xizmat yo'q"

NASIYA = 120_000
oldingi_balans = get_or_create_balance(db).current_balance
print(f"   kassa (oldin): {oldingi_balans:,} so'm")

p = None
t = None
try:
    p = Patient(
        first_name="NasiyaSinov",
        last_name="Bemor",
        birth_date=date(1990, 1, 1),
        phone=f"+99890{uuid.uuid4().int % 10000000:07d}",
        address="Sinov",
        service_id=svc.id,
        payment_amount=NASIYA,
        payment_type="later",     # nasiya — pul hali kelmagan
        cash_amount=0,
        card_amount=0,
        click_amount=0,
        created_by=1,
    )
    db.add(p)
    db.flush()

    t = Transaction(
        patient_id=p.id,
        total_amount=NASIYA,
        center_amount=NASIYA,
        provider_amount=0,
        referrer_amount=0,
        payment_type="later",
    )
    db.add(t)
    db.commit()

    yangi_balans = get_or_create_balance(db).current_balance
    print(f"   kassa (keyin): {yangi_balans:,} so'm")
    print(f"   farq:          {yangi_balans - oldingi_balans:,} so'm   "
          f"(0 bo'lishi kerak)")

    assert p.cash_amount == 0, "nasiyada naqd 0 bo'lishi kerak"
    assert p.card_amount == 0, "nasiyada karta 0 bo'lishi kerak"
    assert p.click_amount == 0, "nasiyada click 0 bo'lishi kerak"
    assert yangi_balans == oldingi_balans, (
        f"Nasiya kassani {yangi_balans - oldingi_balans:,} so'mga "
        f"o'zgartirdi — o'zgartirmasligi kerak")

    print(f"\n✅ O'TDI: {NASIYA:,} so'mlik nasiya kassaga 0 so'm qo'shdi.")
finally:
    if t is not None and t.id:
        db.query(Transaction).filter(Transaction.id == t.id).delete()
    if p is not None and p.id:
        db.query(Patient).filter(Patient.id == p.id).delete()
    db.commit()
    oxirgi = get_or_create_balance(db).current_balance
    print(f"   tozalandi, kassa: {oxirgi:,} so'm")
    assert oxirgi == oldingi_balans, "tozalashdan keyin balans mos kelmadi"
