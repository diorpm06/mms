import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date, datetime
from database import SessionLocal
from models.expense import Expense
from models.advance import Advance
from models.payout import Payout

db = SessionLocal()

d = date(2026, 8, 18)
start_dt = datetime.combine(d, datetime.min.time())
end_dt = datetime.combine(d, datetime.max.time())

print("=== CHECKING ALL EXPENSES AND FINANCES RECORDED FOR YESTERDAY (18.08.2026) ===")

# Expenses
exps = db.query(Expense).filter(Expense.created_at >= start_dt, Expense.created_at <= end_dt).all()
print(f"📌 18-Avgustdagi harajatlar (Expense): {len(exps)} ta")
for x in exps:
    print(f"   • ID:{x.id} | [{x.created_at.strftime('%H:%M')}] | {x.amount:,} so'm | {x.category} | {x.description} | Cancelled: {x.is_cancelled}")

# Advances
advs = db.query(Advance).filter(Advance.created_at >= start_dt, Advance.created_at <= end_dt).all()
print(f"\n📌 18-Avgustdagi Avanslar (Advance): {len(advs)} ta")
for a in advs:
    print(f"   • ID:{a.id} | [{a.created_at.strftime('%H:%M')}] | {a.amount:,} so'm | Note: {a.note} | Cancelled: {a.is_cancelled}")

# Payouts
payouts = db.query(Payout).filter(Payout.created_at >= start_dt, Payout.created_at <= end_dt).all()
print(f"\n📌 18-Avgustdagi Chiqimlar (Payout): {len(payouts)} ta")
for p in payouts:
    print(f"   • ID:{p.id} | [{p.created_at.strftime('%H:%M')}] | {p.amount:,} so'm | Recipient Type: {p.recipient_type}")
