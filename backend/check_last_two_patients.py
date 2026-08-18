import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient

db = SessionLocal()

# Query the last 5 registered patients ordered by id descending
pats = db.query(Patient).filter(Patient.is_cancelled == False).order_by(Patient.id.desc()).limit(5).all()

print("=== OXIRGI RO'YXATDAN O'TGAN BEMORLAR ===")
for idx, p in enumerate(pats[:2], 1):
    svc_name = p.service.name if p.service else "Xizmat biriktirilmagan"
    svc_cat = p.service.category if p.service else ""
    created_str = p.created_at.strftime("%d.%m.%Y %H:%M:%S") if p.created_at else "—"
    payment = f"{p.payment_amount:,} so'm".replace(",", " ")
    ref_name = f" | Yo'naltiruvchi: {p.referrer.full_name}" if p.referrer else ""
    prov_name = f" | Shifokor: {p.provider.full_name}" if p.provider else ""
    
    print(f"\n{idx}. Bemor ID #{p.id}: {p.first_name} {p.last_name}")
    print(f"   • Xizmat nomi: {svc_name} (Bo'lim: {svc_cat})")
    print(f"   • To'lov summasi: {payment} (To'lov turi: {p.payment_type or '—'})")
    print(f"   • Yozilgan vaqti: {created_str}{ref_name}{prov_name}")

print("\n--- ZAHIRA (Top 5 oxirgi bemorlar) ---")
for p in pats:
    created_str = p.created_at.strftime("%H:%M:%S") if p.created_at else "—"
    svc_name = p.service.name if p.service else "—"
    print(f"ID #{p.id} | {p.first_name} {p.last_name} | {svc_name} | {created_str}")
