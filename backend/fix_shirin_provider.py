import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.patient import Patient
from models.provider import Provider
from models.transaction import Transaction
from services.finance import reprice_patient_payment

db = SessionLocal()

# Find patient Sobirova Shirin
p = db.query(Patient).filter(Patient.first_name.ilike("%shirin%")).first()

if not p:
    print("Bemor Sobirova Shirin topilmadi!")
    sys.exit(0)

dr_yulduz = db.query(Provider).filter(Provider.full_name.ilike("%yulduz%")).first()

if not dr_yulduz:
    print("Dr. Yulduz topilmadi!")
    sys.exit(0)

print(f"=== BEMOR SOBIROVA SHIRIN SHIFOKORINI TO'G'RILASH ===")
print(f"Bemor ID: {p.id}, Ismi: {p.first_name} {p.last_name}")
print(f"Hozirgi biriktirilgan shifokor: {p.provider.full_name if p.provider else 'Yo-q'}")
print(f"O'tkazilayotgan to'g'ri shifokor: {dr_yulduz.full_name}")

# Reassign provider
p.provider_id = dr_yulduz.id

# Reprice transaction & update balances
tx = db.query(Transaction).filter(Transaction.patient_id == p.id, Transaction.is_cancelled == False).first()
if tx:
    reprice_patient_payment(db, p, tx)

db.commit()
print("✓ Bemor Sobirova Shirin Dr. Yulduzga o'tkazildi va Dr. G'anijon va Dr. Yulduz balanslari qayta taqsimlanib tuzatildi!")

# Check updated balances
dr_ganijon = db.query(Provider).filter(Provider.full_name.ilike("%g'anijon%")).first()
dr_yulduz = db.query(Provider).filter(Provider.full_name.ilike("%yulduz%")).first()

print(f"\n=== YANGILANGAN BALANSLAR ===")
print(f"• Dr. G'anijon balansi: {dr_ganijon.balance:,} so'm".replace(",", " "))
print(f"• Dr. Yulduz balansi: {dr_yulduz.balance:,} so'm".replace(",", " "))
