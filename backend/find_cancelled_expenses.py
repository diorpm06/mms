import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date, datetime
from database import SessionLocal
from models.expense import Expense
from models.user import User

db = SessionLocal()

print("=== INSPECTING ALL CANCELLED / DELETED EXPENSES IN DATABASE ===")

cancelled = db.query(Expense).filter(Expense.is_cancelled == True).order_by(Expense.id.desc()).all()

print(f"📌 BAZADA BO'LGAN BEKOR QILINGAN/O'CHIRILGAN HARAJATLAR SONI: {len(cancelled)} ta\n")

for e in cancelled:
    u = db.query(User).filter(User.id == e.cancelled_by).first() if e.cancelled_by else None
    u_name = u.username if u else "Noma'lum"
    c_by = db.query(User).filter(User.id == e.created_by).first() if e.created_by else None
    c_name = c_by.username if c_by else "Noma'lum"
    sana = e.created_at.strftime("%d.%m.%Y %H:%M") if e.created_at else "—"
    b_sana = e.cancelled_at.strftime("%d.%m.%Y %H:%M") if e.cancelled_at else "—"
    
    print(f"  • ID: {e.id} | Yaratilgan: [{sana}] (Yaratgan: {c_name})")
    print(f"    - Harajat nomi / Izoh: {e.description}")
    print(f"    - Summasi: {e.amount:,} so'm | Kategoriya: {e.category or 'Boshqa'}")
    print(f"    - Bekor qilingan vaqti: [{b_sana}] | Bekor qilgan xodim: {u_name}")
    print(f"    - Bekor qilish sababi: {e.cancel_reason or 'Sabab ko-rsatilmagan'}")
    print("-" * 60)

# Check yesterday specifically (August 18 or August 19)
all_recent = db.query(Expense).order_by(Expense.id.desc()).limit(20).all()
print("\n📌 RECENT EXPENSES IN DATABASE (LAST 20 RECORDS):")
for e in all_recent:
    st = "🔴 O'CHIRILGAN/BEKOR" if e.is_cancelled else "🟢 FAOL"
    sana = e.created_at.strftime("%d.%m.%Y %H:%M") if e.created_at else "—"
    print(f"  • ID: {e.id} | [{sana}] | {st} | {e.amount:,} so'm | {e.description}")
