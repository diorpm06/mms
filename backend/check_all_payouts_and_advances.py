
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.payout import Payout
from models.advance import Advance
from models.transaction import Transaction
from models.balance import BalanceHistory

db = SessionLocal()

print("=== PAYOUTS (Jami payoutlar) ===")
payouts = db.query(Payout).all()
print(f"Payouts soni: {len(payouts)}")
for p in payouts[:10]:
    print(f"  • Payout #{p.id} | Recipient: {p.recipient_type} #{p.recipient_id} | Amount: {p.amount:,} so'm | Date: {p.created_at}".replace(",", " "))

print("\n=== ADVANCES (Jami avanslar) ===")
advances = db.query(Advance).all()
print(f"Advances soni: {len(advances)}")
for a in advances[:10]:
    print(f"  • Advance #{a.id} | Recipient: {a.recipient_type} #{a.recipient_id} | Amount: {a.amount:,} so'm | Date: {a.created_at}".replace(",", " "))

print("\n=== BALANCE HISTORY (Kassa kirim/chiqim tarixi) ===")
hist = db.query(BalanceHistory).order_by(BalanceHistory.id.desc()).limit(20).all()
print(f"History soni (top 20): {len(hist)}")
for h in hist:
    print(f"  • #{h.id} | Type: {h.entry_type} | Amount: {h.amount:,} so'm | Desc: {h.description} | Date: {h.created_at}".replace(",", " "))
