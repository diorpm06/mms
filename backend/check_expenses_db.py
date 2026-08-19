
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.expense import Expense

db = SessionLocal()

all_expenses = db.query(Expense).order_by(Expense.id.desc()).all()

print(f"=== BAZADAGI BARCHA HARAJAATLAR (Jami: {len(all_expenses)} ta) ===\n")

for exp in all_expenses:
    c_time = exp.created_at.strftime("%d.%m.%Y %H:%M:%S") if exp.created_at else "—"
    status = "🔴 BEKOR QILINGAN" if exp.is_cancelled else "🟢 FAOL"
    print(f"ID #{exp.id} | Summa: {exp.amount:,} so'm | Toifa: {exp.category} | Izoh: {exp.description} | Vaqt: {c_time} | Status: {status}".replace(",", " "))

active_exp = [e for e in all_expenses if not e.is_cancelled]
total_sum = sum(e.amount for e in active_exp)

print(f"\n==================================================")
print(f"FAOL HARAJAATLAR SONI: {len(active_exp)} ta")
print(f"FAOL HARAJAATLAR JAMI SUMMASI: {total_sum:,} so'm".replace(",", " "))
