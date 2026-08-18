import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.referrer import Referrer
from services.reports_data import daily_report, ten_day_report

db = SessionLocal()
today_str = date.today().isoformat()

# 1. Today's Gross Revenue from Referred Patients
pats = db.query(Patient).filter(Patient.is_cancelled == False, Patient.referrer_id.isnot(None)).all()
today_pats = [p for p in pats if p.created_at and p.created_at.isoformat()[:10] == today_str]
today_gross_revenue = sum(p.payment_amount or 0 for p in today_pats)

# 2. Today's Earned Commission/Share
from services.finance import get_referrer_rates_for_service, calculate_financial_split
today_earned_commission = 0
for p in today_pats:
    pct, fix_sum = get_referrer_rates_for_service(p.referrer, p.service, db)
    ref_share, _, _ = calculate_financial_split(p.payment_amount or 0, 0, pct, fix_sum)
    today_earned_commission += ref_share

# 3. All-Time Accumulated Unpaid Balances in DB
referrers = db.query(Referrer).filter(Referrer.is_active == True).all()
all_time_unpaid_balance = sum(r.balance or 0 for r in referrers)

print("=== NIMA SABABDAN TIZIMDA SUMMA BOSHQA / KATTA KO'RINADI? ===\n")
print(f"1. BUGUNGI YO'NALTIRILGAN BEMORLARNING JAMI TUSHUMI (Gross Income): {today_gross_revenue:,} so'm".replace(",", " "))
print(f"2. BUGUN YO'NALTIRUVCHILARGA HISOBLANGAN HAKIQIY ULUSH (Earned Share): {today_earned_commission:,} so'm".replace(",", " "))
print(f"3. BARCHA O'TGAN KUNLARDAN QOLGAN CHIQARILMAGAN JAMI BALANS (All-Time Unpaid Balance): {all_time_unpaid_balance:,} so'm".replace(",", " "))

print("\n--- HAR BIR YO'NALTIRUVCHINING BAZADAGI BALANSI vs BUGUNGI ULUSHI ---")
for r in referrers:
    r_pats = [p for p in today_pats if p.referrer_id == r.id]
    r_today_gross = sum(p.payment_amount or 0 for p in r_pats)
    r_today_share = 0
    for p in r_pats:
        pct, fix_sum = get_referrer_rates_for_service(r, p.service, db)
        s, _, _ = calculate_financial_split(p.payment_amount or 0, 0, pct, fix_sum)
        r_today_share += s
    
    if r_today_gross > 0 or (r.balance or 0) > 0:
        print(f"• {r.full_name}:")
        print(f"    - Bugungi bemorlar tushumi: {r_today_gross:,} so'm".replace(",", " "))
        print(f"    - Bugungi hisoblangan ulushi: {r_today_share:,} so'm".replace(",", " "))
        print(f"    - Bazadagi hozirgi balansi: {r.balance:,} so'm".replace(",", " "))
