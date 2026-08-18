import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.provider import Provider
from models.patient import Patient
from models.user import User

db = SessionLocal()
today_str = date.today().isoformat()

# 1. Check providers with "uzi" in name
provs = db.query(Provider).filter(Provider.full_name.ilike("%uzi%")).all()
print("=== PROVIDERS / SHIFOKORLAR WITH 'UZI' ===")
for pr in provs:
    print(f"ID: {pr.id}, Name: {pr.full_name}, Specialty: {pr.specialty}, Balance: {pr.balance}")

# 2. Check users/doctors with "uzi" in full_name
users = db.query(User).filter(User.full_name.ilike("%uzi%")).all()
print("\n=== USERS / XODIMLAR WITH 'UZI' ===")
for u in users:
    print(f"ID: {u.id}, Name: {u.full_name}, Role: {u.role}")

# 3. Check today's patients for these specific providers
print(f"\n=== BUGUNGI SHIFOKOR UZI BEMORLARI (2026-08-18) ===")
for pr in provs:
    pats = db.query(Patient).filter(Patient.is_cancelled == False, Patient.provider_id == pr.id).all()
    today_pats = [p for p in pats if p.created_at and p.created_at.isoformat()[:10] == today_str]
    print(f"👨‍⚕️ Shifokor: {pr.full_name} — Bugungi bemorlar soni: {len(today_pats)} ta")
    for p in today_pats:
        svc_name = p.service.name if p.service else "Xizmat"
        time_str = p.created_at.strftime("%H:%M") if p.created_at else "—"
        ref_str = f" (Yo'naltiruvchi: {p.referrer.full_name})" if getattr(p, 'referrer', None) else ""
        print(f"   • {p.first_name} {p.last_name} | {svc_name} | {p.payment_amount:,} so'm | Vaqt: {time_str}{ref_str}".replace(",", " "))
