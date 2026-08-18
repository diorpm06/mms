import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.service import Service

db = SessionLocal()
today_str = date.today().isoformat()

# Fetch today's active patients for Laboratory
pats = db.query(Patient).filter(Patient.is_cancelled == False).all()
today_pats = [p for p in pats if p.created_at and p.created_at.isoformat()[:10] == today_str]

lab_patients = []
for p in today_pats:
    svc = p.service
    svc_name = (svc.name if svc else "").strip()
    svc_cat = (svc.category if svc else "").strip()
    combined = f"{svc_cat} {svc_name}".lower()
    
    if any(k in combined for k in [
        "labora", "labar", "tahlil", "gormon", "infeksiya", "biokimyo", "klinik",
        "koagul", "gepatit", "torch", "elektrolit", "allergiya", "revmatoid",
        "siydik", "mazok", "surtma", "oak", "vsk", "crb"
    ]):
        lab_patients.append(p)

print(f"=== BUGUNGI LABORATORIYA BO'LIMI ({today_str}) ===\n")
print(f"Jami Laboratoriyaga yozilgan bemorlar/xizmatlar soni: {len(lab_patients)} ta\n")

from collections import defaultdict
service_counts = defaultdict(list)

for p in lab_patients:
    svc_name = p.service.name if p.service else "Laboratoriya Xizmati"
    service_counts[svc_name].append(p)

total_lab_sum = 0
for svc_name, plist in service_counts.items():
    svc_sum = sum(p.payment_amount or 0 for p in plist)
    total_lab_sum += svc_sum
    print(f"🧪 {svc_name}: {len(plist)} ta bemor | Jami summa: {svc_sum:,} so'm".replace(",", " "))
    for p in plist:
        time_str = p.created_at.strftime("%H:%M") if p.created_at else "—"
        ref_str = f" (Yo'naltiruvchi: {p.referrer.full_name})" if getattr(p, 'referrer', None) else ""
        prov_str = f" (Shifokor: {p.provider.full_name})" if getattr(p, 'provider', None) else ""
        print(f"   • {p.first_name} {p.last_name} | {p.payment_amount:,} so'm | Vaqt: {time_str}{ref_str}{prov_str}".replace(",", " "))
    print()

print(f"==================================================")
print(f"JAMI LABORATORIYA BO'LIMI TUSHUMI: {total_lab_sum:,} so'm".replace(",", " "))
