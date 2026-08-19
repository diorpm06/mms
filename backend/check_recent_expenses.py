
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.expense import Expense

db = SessionLocal()

all_exps = db.query(Expense).order_by(Expense.id.desc()).all()

print(f"=== RECENT EXPENSES IN DATABASE (Total: {len(all_exps)}) ===")
for e in all_exps:
    c_time = e.created_at.strftime("%d.%m.%Y %H:%M:%S") if e.created_at else "—"
    status = "🔴 BEKOR" if e.is_cancelled else "🟢 FAOL"
    print(f"ID #{e.id} | {e.amount:,} so'm | Kat: {e.category} | Desc: {e.description} | Date: {c_time} | {status}".replace(",", " "))
