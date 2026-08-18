import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.service import Service
from models.provider import Provider

db = SessionLocal()
today_str = date.today().isoformat()

# Fetch today's active patients for Massage
pats = db.query(Patient).filter(Patient.is_cancelled == False).all()
today_pats = [p for p in pats if p.created_at and p.created_at.isoformat()[:10] == today_str]

massage_patients = []
for p in today_pats:
    svc = p.service
    svc_name = (svc.name if svc else "").strip()
    svc_cat = (svc.category if svc else "").strip()
    combined = f"{svc_cat} {svc_name}".lower()
    
    if any(k in combined for k in ["massaj", "массаж"]):
        massage_patients.append(p)

print(f"=== BUGUNGI MASSAJ BO'LIMI ({today_str}) ===\n")
print(f"Jami Massajga yozilgan bemorlar/xizmatlar soni: {len(massage_patients)} ta\n")

from collections import defaultdict
service_counts = defaultdict(list)

for p in massage_patients:
    svc_name = p.service.name if p.service else "Massaj Xizmati"
    service_counts[svc_name].append(p)

total_massage_sum = 0
for svc_name, plist in service_counts.items():
    svc_sum = sum(p.payment_amount or 0 for p in plist)
    total_massage_sum += svc_sum
    print(f"💆 {svc_name}: {len(plist)} ta bemor | Jami summa: {svc_sum:,} so'm".replace(",", " "))
    for p in plist:
        time_str = p.created_at.strftime("%H:%M") if p.created_at else "—"
        ref_str = f" (Yo'naltiruvchi: {p.referrer.full_name})" if getattr(p, 'referrer', None) else ""
        prov_str = f" (Shifokor: {p.provider.full_name})" if getattr(p, 'provider', None) else ""
        print(f"   • {p.first_name} {p.last_name} | {p.payment_amount:,} so'm | Vaqt: {time_str}{ref_str}{prov_str}".replace(",", " "))
    print()

print(f"==================================================")
print(f"JAMI MASSAJ BO'LIMI TUSHUMI: {total_massage_sum:,} so'm".replace(",", " "))

# Check Doctor/Provider breakdown for Massage
doc_counts = defaultdict(list)
for p in massage_patients:
    doc_name = p.provider.full_name if p.provider else "Shifokor biriktirilmagan"
    doc_counts[doc_name].append(p)

print(f"\n=== SHIFOKORLAR BO'YICHA MASSAJ HISOBLARI ===")
for d_name, plist in doc_counts.items():
    d_gross = sum(p.payment_amount or 0 for p in plist)
    doc_obj = plist[0].provider if plist[0].provider else None
    doc_pct = doc_obj.percentage if doc_obj else 0
    doc_earned = sum(int((p.payment_amount or 0) * doc_pct / 100) for p in plist)
    print(f"👨‍⚕️ {d_name} (Foiz: {doc_pct}%):")
    print(f"   - Bemorlar soni: {len(plist)} ta")
    print(f"   - Jami tushum: {d_gross:,} so'm".replace(",", " "))
    print(f"   - Shifokor ulushi ({doc_pct}%): {doc_earned:,} so'm".replace(",", " "))
