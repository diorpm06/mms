
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.expense import Expense

db = SessionLocal()

print("=== POSTGRESQL BAZASIDAGI BARCHA HARAJAATLAR (Expense) ===")
exps = db.query(Expense).order_by(Expense.id.desc()).all()
print(f"Jami yozuvlar soni: {len(exps)}\n")

for e in exps:
    c_time = e.created_at.strftime("%d.%m.%Y %H:%M:%S") if e.created_at else "—"
    status = "🔴 BEKOR" if e.is_cancelled else "🟢 FAOL"
    print(f"ID #{e.id} | Summa: {e.amount:,} so'm | Kat: {e.category} | Izoh: {e.description} | Sana: {c_time} | Status: {status}".replace(",", " "))
