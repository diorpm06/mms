
import sys, io, sqlite3
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import datetime
from database import SessionLocal
from models.expense import Expense

# Connect to local SQLite DB
sqlite_conn = sqlite3.connect("marjona_med.db")
cur = sqlite_conn.cursor()

cur.execute("SELECT id, description, amount, created_by, created_at, is_cancelled, category FROM expenses")
sqlite_rows = cur.fetchall()

db = SessionLocal()

print("=== LOCAL SQLITE DAN POSTGRESQL GA HARAJAATLARNI KO'CHIRISH ===")
imported_count = 0

for r in sqlite_rows:
    exp_id, desc, amt, c_by, c_at_str, is_canc, cat = r
    
    # Check if already exists in PostgreSQL by description and amount
    exists = db.query(Expense).filter(
        Expense.amount == amt,
        Expense.description == desc,
    ).first()
    
    if not exists:
        try:
            dt = datetime.fromisoformat(c_at_str)
        except Exception:
            dt = datetime.now()
            
        new_exp = Expense(
            description=desc,
            amount=amt,
            created_by=c_by or 1,
            created_at=dt,
            is_cancelled=bool(is_canc),
            category=cat or "Boshqa",
        )
        db.add(new_exp)
        imported_count += 1
        print(f"  ✓ Ko'chirildi: #{exp_id} | {desc} | {amt:,} so'm | Sana: {c_at_str}".replace(",", " "))

db.commit()
print(f"\n==================================================")
print(f"JAMI YANGI KO'CHIRILGAN HARAJAATLAR: {imported_count} ta")

# Verify PostgreSQL expenses
all_pg = db.query(Expense).order_by(Expense.id.desc()).all()
print(f"\nPOSTGRESQL DAGI JAMI HARAJAATLAR SONI: {len(all_pg)} ta")
for e in all_pg:
    print(f"  • ID #{e.id} | {e.description} | {e.amount:,} so'm | Sana: {e.created_at.strftime('%d.%m.%Y %H:%M')}".replace(",", " "))
