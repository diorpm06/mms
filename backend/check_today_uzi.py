import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.service import Service
from models.inpatient import Inpatient

db = SessionLocal()
today_str = date.today().isoformat()

# Fetch today's patients whose service or category is UZI
pats = db.query(Patient).filter(Patient.is_cancelled == False).all()
today_pats = [p for p in pats if p.created_at and p.created_at.isoformat()[:10] == today_str]

uzi_patients = []
for p in today_pats:
    svc = p.service
    svc_name = (svc.name if svc else "").strip()
    svc_cat = (svc.category if svc else "").strip()
    combined = f"{svc_cat} {svc_name}".lower()
    
    if any(k in combined for k in ["uzi", "узи", "ultratovush", "ultrazvuk"]):
        uzi_patients.append(p)

print(f"=== BUGUNGI UZI BO'LIMI XIZMATLARI ({today_str}) ===\n")
print(f"Jami UZI bo'limiga yozilgan bemorlar/xizmatlar soni: {len(uzi_patients)} ta\n")

# Group by Service Name
from collections import defaultdict
service_counts = defaultdict(list)

for p in uzi_patients:
    svc_name = p.service.name if p.service else "UZI Xizmati"
    service_counts[svc_name].append(p)

total_uzi_sum = 0
for svc_name, plist in service_counts.items():
    svc_sum = sum(p.payment_amount or 0 for p in plist)
    total_uzi_sum += svc_sum
    print(f"📌 {svc_name}: {len(plist)} ta bemor, Jami summa: {svc_sum:,} so'm".replace(",", " "))
    for p in plist:
        time_str = p.created_at.strftime("%H:%M") if p.created_at else "—"
        ref_str = f" (Yo'naltiruvchi: {p.referrer.full_name})" if getattr(p, 'referrer', None) else ""
        print(f"   • {p.first_name} {p.last_name} | {p.payment_amount:,} so'm | Vaqt: {time_str}{ref_str}".replace(",", " "))
    print()

print(f"==================================================")
print(f"JAMI UZI BO'LIMI TUSHUMI: {total_uzi_sum:,} so'm".replace(",", " "))
