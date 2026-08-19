import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date, datetime
from database import SessionLocal
from models.expense import Expense
from models.audit_log import AuditLog
from models.user import User

db = SessionLocal()

yesterday = date(2026, 8, 18)
start_dt = datetime.combine(yesterday, datetime.min.time())
end_dt = datetime.combine(yesterday, datetime.max.time())

print(f"=== INSPECTING ALL YESTERDAY'S EXPENSES (18.08.2026) ===")

# 1. All expenses created on 18.08.2026
yesterday_expenses = (
    db.query(Expense)
    .filter(Expense.created_at >= start_dt, Expense.created_at <= end_dt)
    .order_by(Expense.id.asc())
    .all()
)

print(f"📌 Kecha (18.08.2026) yaratilgan jami harajatlar soni: {len(yesterday_expenses)} ta\n")

for e in yesterday_expenses:
    st = "🔴 O'CHIRILGAN/BEKOR" if e.is_cancelled else "🟢 FAOL"
    u = db.query(User).filter(User.id == e.created_by).first() if e.created_by else None
    u_name = u.username if u else "Noma'lum"
    sana = e.created_at.strftime("%H:%M") if e.created_at else "—"
    
    print(f"  • ID: {e.id} | Vaqt: [{sana}] | Holat: {st}")
    print(f"    - Tavsif / Nomi: {e.description}")
    print(f"    - Summa: {e.amount:,} so'm | Kategoriya: {e.category or 'Boshqa'} | Yaratgan: {u_name}")
    if e.is_cancelled:
        print(f"    - Bekor qilingan vaqti: {e.cancelled_at} | Sabab: {e.cancel_reason}")
    print("-" * 65)

# 2. Check all audit logs on 18.08.2026 and 19.08.2026 relating to expenses
print("\n📌 Audit Loglarda harajatlar bo'yicha bekor qilish yoki o'chirish yozuvlari:")
logs = (
    db.query(AuditLog)
    .filter(
        AuditLog.created_at >= start_dt,
        AuditLog.action_type.ilike("%EXPENSE%")
    )
    .all()
)
print(f"Topilgan audit loglar soni: {len(logs)} ta")
for l in logs:
    print(f"  • [{l.created_at}] Action: {l.action_type} | User ID: {l.user_id}")
    print(f"    Data: {l.new_data}")
