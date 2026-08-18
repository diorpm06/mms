import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.transaction import Transaction
from models.provider import Provider
from models.referrer import Referrer
from services.finance import reprice_patient_payment

db = SessionLocal()
today_str = date.today().isoformat()

# Fetch all active patients from today
pats = db.query(Patient).filter(Patient.is_cancelled == False).all()
today_pats = [p for p in pats if p.created_at and p.created_at.isoformat()[:10] == today_str]

print(f"=== BUGUNGI BEMORLAR TAQSIMOTINI TO'G'RILASH ({today_str}) ===")
print(f"Qayta hisoblanadigan bemorlar soni: {len(today_pats)} ta")

for p in today_pats:
    tx = db.query(Transaction).filter(Transaction.patient_id == p.id, Transaction.is_cancelled == False).first()
    if tx:
        reprice_patient_payment(db, p, tx)

db.commit()
print("✓ Barcha bugungi tranzaksiyalar va shifokorlar balanslari to'g'ridan-to'g'ri (Direct Split) mantiq bo'yicha qayta hisoblandi va saqlandi!")

# Print updated provider balances
provs = db.query(Provider).filter(Provider.is_active == True).all()
print("\n=== YANGILANGAN SHIFOKORLAR BALANSI ===")
for pr in provs:
    print(f"  • {pr.full_name}: {pr.balance:,} so'm".replace(",", " "))
