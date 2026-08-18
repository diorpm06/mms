import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.transaction import Transaction
from models.referrer import Referrer
from sqlalchemy import func

db = SessionLocal()

# 1. Check duplicate transactions for same patient
dup_txs = (
    db.query(Transaction.patient_id, func.count(Transaction.id))
    .filter(Transaction.is_cancelled == False)
    .group_by(Transaction.patient_id)
    .having(func.count(Transaction.id) > 1)
    .all()
)

print(f"=== TRANZAKSIYALAR TEKSHIRUVI ===")
print(f"Takroriy tranzaksiyaga ega bemorlar soni: {len(dup_txs)} ta")

# 2. Check total of all referrer.balance in DB
referrers = db.query(Referrer).all()
print(f"\n=== YO'NALTIRUVCHILARNING HOZIRGI BALANSI ===")
for r in referrers:
    if r.balance != 0:
        print(f"  • {r.full_name}: {r.balance:,} so'm (Faol: {r.is_active})".replace(",", " "))

# 3. Check today's transactions vs patients
today_str = date.today().isoformat()
today_pats = db.query(Patient).filter(Patient.is_cancelled == False, Patient.referrer_id.isnot(None)).all()
today_pats = [p for p in today_pats if p.created_at and p.created_at.isoformat()[:10] == today_str]

print(f"\n=== BUGUNGI BEMORLAR (2026-08-18) ===")
print(f"Bugungi yo'naltirilgan bemorlar soni: {len(today_pats)} ta")
sum_pat_pay = sum(p.payment_amount or 0 for p in today_pats)
print(f"Bemorlar to'lagan jami summa: {sum_pat_pay:,} so'm".replace(",", " "))

today_txs = db.query(Transaction).filter(Transaction.is_cancelled == False, Transaction.referrer_id.isnot(None)).all()
today_txs = [t for t in today_txs if t.created_at and t.created_at.isoformat()[:10] == today_str]
sum_tx_ref_amt = sum(t.referrer_amount or 0 for t in today_txs)
sum_tx_total = sum(t.total_amount or 0 for t in today_txs)

print(f"Tranzaksiyalardagi Jami bemor to'lovi: {sum_tx_total:,} so'm".replace(",", " "))
print(f"Tranzaksiyalardagi Yo'naltiruvchilar ulushi (referrer_amount): {sum_tx_ref_amt:,} so'm".replace(",", " "))
