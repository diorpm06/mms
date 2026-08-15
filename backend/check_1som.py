import os
import sys

env_file = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_file):
    with open(env_file, 'r', encoding='utf-8') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k] = v

sys.path.append(os.path.dirname(__file__))

from database import SessionLocal
from models.patient import Patient
from models.transaction import Transaction

db = SessionLocal()

pts = db.query(Patient).all()
print(f"--- ALL PATIENTS ({len(pts)}) ---")
for p in pts:
    print(f"Patient ID: {p.id} | Name: {p.first_name} {p.last_name} | Phone: '{p.phone}' | Amount: {p.payment_amount} | Date: {p.created_at}")

txs = db.query(Transaction).all()
print(f"\n--- ALL TRANSACTIONS ({len(txs)}) ---")
for t in txs:
    print(f"Tx ID: {t.id} | Patient ID: {t.patient_id} | Total: {t.total_amount} | Prov: {t.provider_amount} | Ref: {t.referrer_amount} | Center: {t.center_amount} | Date: {t.created_at}")

db.close()
