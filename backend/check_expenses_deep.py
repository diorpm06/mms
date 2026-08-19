
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.expense import Expense
from models.payout import Payout
from models.advance import Advance
from models.provider_advance import ProviderAdvance
from models.salary_log import SalaryLog
from models.balance import BalanceHistory

db = SessionLocal()

print("=== 1. HARAJAATLAR (Expense jadvali) ===")
exps = db.query(Expense).all()
print(f"Jami yozuvlar: {len(exps)}")
for e in exps:
    print(f"  • ID #{e.id} | Summa: {e.amount:,} | Kat: {e.category} | Izoh: {e.description} | Sana: {e.created_at} | Bekor: {e.is_cancelled}".replace(",", " "))

print("\n=== 2. PROVIDER ADVANCES (Shifokor Avanslari) ===")
pas = db.query(ProviderAdvance).all()
print(f"Jami yozuvlar: {len(pas)}")
for pa in pas:
    print(f"  • ID #{pa.id} | Recipient: {pa.recipient_type} #{pa.recipient_id} | Summa: {pa.amount:,} | Sana: {pa.created_at}".replace(",", " "))

print("\n=== 3. EMPLOYEE ADVANCES (Xodim Avanslari) ===")
eas = db.query(Advance).all()
print(f"Jami yozuvlar: {len(eas)}")
for ea in eas:
    print(f"  • ID #{ea.id} | Emp #{ea.employee_id} | Summa: {ea.amount:,} | Sana: {ea.created_at}".replace(",", " "))

print("\n=== 4. SALARY LOGS (Oyliklar) ===")
sals = db.query(SalaryLog).all()
print(f"Jami yozuvlar: {len(sals)}")
for s in sals:
    print(f"  • ID #{s.id} | Emp #{s.employee_id} | Summa: {s.amount:,} | Sana: {s.paid_at}".replace(",", " "))

print("\n=== 5. PAYOUTS (Chiqarimlar) ===")
pos = db.query(Payout).all()
print(f"Jami yozuvlar: {len(pos)}")
for p in pos:
    print(f"  • ID #{p.id} | Type: {p.recipient_type} #{p.recipient_id} | Summa: {p.amount:,} | Sana: {p.created_at}".replace(",", " "))
