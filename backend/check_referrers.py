from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.referrer import Referrer
from models.inpatient import Inpatient

db = SessionLocal()
today_str = date.today().isoformat()

# 1. Ambulator yo'naltiruvchi bemorlar
patients = db.query(Patient).filter(
    Patient.is_cancelled == False,
    Patient.referrer_id.isnot(None)
).all()

today_pats = [p for p in patients if p.created_at and p.created_at.isoformat()[:10] == today_str]

# 2. Statsionar yo'naltiruvchi bemorlar
inpatients = db.query(Inpatient).filter(
    Inpatient.is_cancelled == False,
    Inpatient.referrer_id.isnot(None)
).all()

today_inps = [i for i in inpatients if i.admitted_at and i.admitted_at.isoformat()[:10] == today_str]

print(f"=== BUGUNGI YO'NALTIRUVCHILAR TAFSILOTI ({today_str}) ===")
print(f"Ambulator yo'naltirilgan bemorlar soni: {len(today_pats)} ta")

for idx, p in enumerate(today_pats, 1):
    ref_name = p.referrer.full_name if getattr(p, 'referrer', None) else f"ID #{p.referrer_id}"
    svc_name = p.service.name if getattr(p, 'service', None) else "Xizmat"
    amount = p.payment_amount or 0
    print(f"  {idx}. Bemor: {p.first_name} {p.last_name}")
    print(f"     • Yo'naltiruvchi (Kimdan): {ref_name}")
    print(f"     • Xizmat: {svc_name}")
    print(f"     • To'lov summasi: {amount:,} so'm".replace(",", " "))
    print(f"     • Vaqt: {p.created_at.strftime('%H:%M')}")

print(f"\nStatsionar yo'naltirilgan bemorlar soni: {len(today_inps)} ta")
for idx, i in enumerate(today_inps, 1):
    ref_name = i.referrer.full_name if getattr(i, 'referrer', None) else f"ID #{i.referrer_id}"
    print(f"  {idx}. Bemor: {i.first_name} {i.last_name}")
    print(f"     • Yo'naltiruvchi (Kimdan): {ref_name}")
    print(f"     • Palata: {i.room_number}/{i.bed_number}")
    print(f"     • Kunlik narx: {i.daily_rate:,} so'm")

print(f"\nJAMI YO'NALTIRILGAN BEMORLAR SONI: {len(today_pats) + len(today_inps)} ta")
