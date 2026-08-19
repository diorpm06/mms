
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date, datetime
from database import SessionLocal
from models.expense import Expense
from models.payout import Payout
from models.advance import Advance
from models.provider_advance import ProviderAdvance
from models.balance import BalanceHistory

db = SessionLocal()
today_str = date.today().isoformat()

print(f"=== BUGUNGI SANA ({today_str}) BO'YICHA YAZILGAN BARCHA HARAJAAT/CHIQIMLAR ===\n")

exps = db.query(Expense).all()
today_exps = [e for e in exps if e.created_at and e.created_at.isoformat()[:10] == today_str]

print(f"1. BUGUNGI HARAJAATLAR (Expense jadvali): {len(today_exps)} ta")
for e in today_exps:
    t_str = e.created_at.strftime("%H:%M:%S")
    st = "🔴 Bekor" if e.is_cancelled else "🟢 Faol"
    print(f"   • ID #{e.id} | {e.amount:,} so'm | Kat: {e.category} | Izoh: {e.description} | Vaqt: {t_str} | {st}".replace(",", " "))

payouts = db.query(Payout).all()
today_payouts = [p for p in payouts if p.created_at and p.created_at.isoformat()[:10] == today_str]

print(f"\n2. BUGUNGI PAYOUTLAR (Chiqarimlar/Shifokor-Yo'naltiruvchi to'lovlari): {len(today_payouts)} ta")
for p in today_payouts:
    t_str = p.created_at.strftime("%H:%M:%S")
    print(f"   • Payout #{p.id} | {p.amount:,} so'm | Type: {p.recipient_type} #{p.recipient_id} | Vaqt: {t_str}".replace(",", " "))

prov_adv = db.query(ProviderAdvance).all()
today_prov_adv = [pa for pa in prov_adv if pa.created_at and pa.created_at.isoformat()[:10] == today_str]

print(f"\n3. BUGUNGI SHIFOKOR AVANSLARI (ProviderAdvance): {len(today_prov_adv)} ta")
for pa in today_prov_adv:
    t_str = pa.created_at.strftime("%H:%M:%S")
    print(f"   • ID #{pa.id} | {pa.amount:,} so'm | Type: {pa.recipient_type} #{pa.recipient_id} | Izoh: {pa.note} | Vaqt: {t_str}".replace(",", " "))

emp_adv = db.query(Advance).all()
today_emp_adv = [ea for ea in emp_adv if ea.created_at and ea.created_at.isoformat()[:10] == today_str]

print(f"\n4. BUGUNGI XODIM AVANSLARI (Advance): {len(today_emp_adv)} ta")
for ea in today_emp_adv:
    t_str = ea.created_at.strftime("%H:%M:%S")
    print(f"   • ID #{ea.id} | {ea.amount:,} so'm | Emp #{ea.employee_id} | Izoh: {ea.note} | Vaqt: {t_str}".replace(",", " "))

b_hist = db.query(BalanceHistory).all()
today_b_hist = [b for b in b_hist if b.created_at and b.created_at.isoformat()[:10] == today_str]

print(f"\n5. BUGUNGI KASSA CHIQIMLARI (BalanceHistory): {len(today_b_hist)} ta")
for bh in today_b_hist:
    t_str = bh.created_at.strftime("%H:%M:%S")
    print(f"   • #{bh.id} | Amount: {bh.amount:,} so'm | Type: {bh.entry_type} | Desc: {bh.description} | Vaqt: {t_str}".replace(",", " "))
