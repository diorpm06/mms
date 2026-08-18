from datetime import date
from database import SessionLocal
from services.reports_data import daily_report, ten_day_report
from models.referrer import Referrer

db = SessionLocal()
today = date.today()

report = daily_report(db, today)

print("=== 1. DAILY REPORT (GET /api/reports/daily) ===")
print("referrer_share (Jami ulush):", f"{report.get('referrer_share', 0):,} so'm".replace(",", " "))
print("referrers_breakdown (Yo'naltiruvchilar jadvali):")
for r in report.get("referrers_breakdown", []):
    print(f"  - {r['name']}: {r['count']} ta bemor, Summa: {r['total']:,} so'm".replace(",", " "))

print("\n=== 2. REFERRERS REPORT (GET /api/reports/ten-day) ===")
ref_report = ten_day_report(db, today, today)
for r in ref_report.get("referrers_payout", []):
    print(f"  - {r['referrer_name']}: {r['patient_count']} ta bemor, Jami tushum: {r['gross_total']:,} so'm, Haqi (Ulushi): {r['total_commission']:,} so'm".replace(",", " "))

print("\n=== 3. REFERRERS PAGE (GET /api/referrers) ===")
refs = db.query(Referrer).filter(Referrer.is_active == True).all()
total_balance_all_time = sum(r.balance or 0 for r in refs)
print("Jami o'tgan barcha vaqtlar balansi (All-time Accumulated Balance):", f"{total_balance_all_time:,} so'm".replace(",", " "))
