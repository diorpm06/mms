import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.transaction import Transaction
from models.patient import Patient
from models.provider import Provider

db = SessionLocal()
doc = db.query(Provider).filter(Provider.full_name.ilike("%ortiqboy%")).first()

txs = db.query(Transaction).filter(Transaction.is_cancelled == False, Transaction.provider_id == doc.id).all()

print(f"=== TRANSACTIONS ACCRUED FOR DR A.ORTIQBOY ===")
total_tx_prov_amount = 0
for t in txs:
    p = db.query(Patient).filter(Patient.id == t.patient_id).first()
    p_name = f"{p.first_name} {p.last_name}" if p else "Noma'lum"
    print(f"Tx #{t.id} | Bemor: {p_name} | Total: {t.total_amount:,} | Referrer Share: {t.referrer_amount:,} | Doctor Share: {t.provider_amount:,} | Clinic Share: {t.center_amount:,}".replace(",", " "))
    total_tx_prov_amount += (t.provider_amount or 0)

print(f"\nJami Tranzaksiyalarda Dr A.Ortiqboyga yozilgan summa: {total_tx_prov_amount:,} so'm".replace(",", " "))
print(f"Provider balansi (doc.balance): {doc.balance:,} so'm".replace(",", " "))
