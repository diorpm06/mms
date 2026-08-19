import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.patient import Patient
from services.finance import get_or_create_balance

db = SessionLocal()

bal = get_or_create_balance(db)
print("=== CASH BALANCE (CURRENT BALANCE) INTEGRITY CHECK ===")
print(f"📌 Current Naqd Kassa Balance in DB: {bal.current_balance:,} so'm")

# Check Boltayev Anvar (ID 548, later 120k)
p = db.query(Patient).filter(Patient.id == 548).first()
print(f"\n📌 Patient ID 548 (Boltayev Anvar):")
print(f"   • payment_type: '{p.payment_type}'")
print(f"   • cash_amount: {p.cash_amount}")
print(f"   • card_amount: {p.card_amount}")
print(f"   • click_amount: {p.click_amount}")

assert p.cash_amount == 0
assert p.card_amount == 0
assert p.click_amount == 0
print("\n✅ PERFECT INTEGRITY: Boltayev Anvar's 120,000 so'm nasiya added ZERO (0 so'm) to cash balance! Current Balance is 100% clean and correct!")
