import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.referrer import Referrer
from services.finance import get_referrer_rates_for_service, calculate_financial_split

db = SessionLocal()
today_str = date.today().isoformat()

referrers = db.query(Referrer).filter(Referrer.is_active == True).all()

print(f"=== BUGUNGI YO'NALTIRUVCHILAR TIZIM FOIZI VA HISOB-KITOB BALANSI TEKSHIRUVI ({today_str}) ===\n")

total_today_earned_all = 0
discrepancies = []

for ref in referrers:
    # Today's active (non-cancelled) patients for this referrer
    pats = db.query(Patient).filter(
        Patient.is_cancelled == False,
        Patient.referrer_id == ref.id
    ).all()
    
    today_pats = [p for p in pats if p.created_at and p.created_at.isoformat()[:10] == today_str]
    
    if not today_pats:
        continue

    print(f"👤 YO'NALTIRUVCHI: {ref.full_name}")
    print(f"   • Sozlamalar: Lab: {ref.lab_percent}%, Fizio: {ref.fizio_percent}%, UZI: {ref.uzi_sum:,} so'm, Ozon: {ref.ozon_sum:,} so'm".replace(",", " "))
    
    ref_today_paid = 0
    ref_today_share = 0

    for p in today_pats:
        paid = p.payment_amount or 0
        ref_today_paid += paid
        
        # Get actual rate & fixed sum for this specific service
        pct, fix_sum = get_referrer_rates_for_service(ref, p.service, db)
        
        # Use exact system share calculation
        ref_share, prov_share, cent_share = calculate_financial_split(
            total=paid,
            provider_percentage=0,
            referrer_percentage=pct,
            referrer_commission_sum=fix_sum
        )
        
        ref_today_share += ref_share
        
        rate_str = f"{pct}%" if pct > 0 else f"{fix_sum:,} so'm fixed"
        svc_name = p.service.name if p.service else "Xizmat"
        print(f"     - Bemor: {p.first_name} {p.last_name} | {svc_name} | To'lov: {paid:,} so'm | Tarif ({rate_str}) -> Ulush: {ref_share:,} so'm".replace(",", " "))

    total_today_earned_all += ref_today_share
    
    print(f"   ► Bugungi jami tushum (shu yo'naltiruvchidan): {ref_today_paid:,} so'm".replace(",", " "))
    print(f"   ► Bugun hisoblangan umumiy ulush: {ref_today_share:,} so'm".replace(",", " "))
    print(f"   ► Bazadagi Hozirgi Balansi (Total Balance): {ref.balance:,} so'm\n".replace(",", " "))

print(f"==================================================")
print(f"JAMI BUGUN YO'NALTIRUVCHILARGA HISOBLANGAN ULUSH: {total_today_earned_all:,} so'm".replace(",", " "))
