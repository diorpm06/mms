import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.provider import Provider
from models.patient import Patient
from services.finance import get_referrer_rates_for_service, calculate_financial_split

db = SessionLocal()
today_str = date.today().isoformat()

# Fetch Dr A.Ortiqboy
doc = db.query(Provider).filter(Provider.full_name.ilike("%ortiqboy%")).first()

if not doc:
    print("Dr A.Ortiqboy topilmadi!")
    sys.exit(0)

print(f"=== DR A.ORTIQBOY HISOBLARI VA SOZLAMALARI ===")
print(f"ID: {doc.id}")
print(f"Ismi: {doc.full_name}")
print(f"Tizimdagi belgilangan shifokor foizi (provider.percentage): {doc.percentage}%")
print(f"Bazadagi hozirgi to'lanadigan balansi (provider.balance): {doc.balance:,} so'm".replace(",", " "))

# Fetch today's patients for Dr A.Ortiqboy
pats = db.query(Patient).filter(Patient.is_cancelled == False, Patient.provider_id == doc.id).all()
today_pats = [p for p in pats if p.created_at and p.created_at.isoformat()[:10] == today_str]

print(f"\n--- BUGUNGI BEMORLARI (2026-08-18) ---")
print(f"Bemorlar soni: {len(today_pats)} ta")

total_paid = 0
expected_doctor_earned = 0

for idx, p in enumerate(today_pats, 1):
    paid = p.payment_amount or 0
    total_paid += paid
    
    # Calculate provider share using financial split
    ref_pct, ref_sum = (0, 0)
    if p.referrer_id:
        ref_pct, ref_sum = get_referrer_rates_for_service(p.referrer, p.service, db)
        
    ref_share, prov_share, cent_share = calculate_financial_split(
        total=paid,
        provider_percentage=doc.percentage,
        referrer_percentage=ref_pct,
        referrer_commission_sum=ref_sum,
        is_uzi=False
    )
    
    expected_doctor_earned += prov_share
    svc_name = p.service.name if p.service else "Xizmat"
    ref_name = f" (Yo'naltiruvchi: {p.referrer.full_name})" if p.referrer else ""
    print(f"  {idx}. Bemor: {p.first_name} {p.last_name} | Xizmat: {svc_name} | To'lov: {paid:,} so'm | Foiz: {doc.percentage}% -> Shifokor ulushi: {prov_share:,} so'm{ref_name}".replace(",", " "))

print(f"\n► Bugungi Laboratoriya jami tushumi: {total_paid:,} so'm".replace(",", " "))
print(f"► Dr A.Ortiqboy bugun ishlashi kerak bo'lgan ulush ({doc.percentage}% bo'yicha): {expected_doctor_earned:,} so'm".replace(",", " "))
print(f"► Bazadagi jami yig'ilgan balansi (provider.balance): {doc.balance:,} so'm".replace(",", " "))
