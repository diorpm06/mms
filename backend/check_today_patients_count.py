
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient

db = SessionLocal()
today_str = date.today().isoformat()

pats_all = db.query(Patient).filter(Patient.is_cancelled == False).all()

today_pats = [p for p in pats_all if p.created_at and p.created_at.isoformat()[:10] == today_str]

print(f"=== BUGUNGI BEMORLAR SANOQAT HISOBOBO ({today_str}) ===")
print(f"📌 Bugun ({today_str}) ro'yxatdan o'tgan bemorlar/xizmatlar soni: {len(today_pats)} ta\n")

if len(today_pats) > 0:
    total_paid = sum(p.payment_amount or 0 for p in today_pats)
    print(f"💰 Jami tushum summasi: {total_paid:,} so'm".replace(",", " "))
    print("\n--- BEMORLAR RO'YXATI ---")
    for idx, p in enumerate(today_pats, 1):
        svc_name = p.service.name if p.service else "—"
        t_str = p.created_at.strftime("%H:%M:%S") if p.created_at else "—"
        print(f"  {idx}. {p.first_name} {p.last_name} | Xizmat: {svc_name} | To'lov: {p.payment_amount:,} so'm | Vaqt: {t_str}".replace(",", " "))
else:
    print("Bugungi kunda hali yangi bemor ro'yxatdan o'tmagan.")

# Also check 2026-08-18 just in case
aug18_pats = [p for p in pats_all if p.created_at and p.created_at.isoformat()[:10] == "2026-08-18"]
print(f"\n--- MA'LUMOT UCHUN: KECHAGI (2026-08-18) BEMORLAR SONI ---")
print(f"📌 2026-08-18 kuni ro'yxatdan o'tgan bemorlar soni: {len(aug18_pats)} ta")
print(f"💰 Jami tushum summasi: {sum(p.payment_amount or 0 for p in aug18_pats):,} so'm".replace(",", " "))
