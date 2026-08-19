
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.expense import Expense
from sqlalchemy import extract
from routers.expenses import sync_advances_and_salaries_to_expenses, _expense_out

db = SessionLocal()

# Sync advances first
sync_advances_and_salaries_to_expenses()

# Query August 2026 expenses
items = db.query(Expense).filter(
    Expense.is_cancelled == False,
    extract("year", Expense.created_at) == 2026,
    extract("month", Expense.created_at) == 8,
).order_by(Expense.created_at.desc()).all()

print(f"=== AVGUST 2026 HARAJAATLAR RO'YXATI (Jami: {len(items)} ta) ===")
for e in items:
    out = _expense_out(e)
    dt_str = e.created_at.strftime("%d.%m.%Y %H:%M")
    print(f"  • ID #{out['id']} | {out['description']} | {out['amount']:,} so'm | Sana: {dt_str} | Kat: {out['category']} | Manba: {out['source']}".replace(",", " "))
