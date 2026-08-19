import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from services.reports_data import get_report, admin_dashboard_summary, admin_daily_report

db = SessionLocal()
today = date.today()

report = get_report(db, today, today)
admin_summary = admin_dashboard_summary(db, today)
daily_adm = admin_daily_report(db, today)

print("=== CHECKING UNPAID PATIENT (120k) IN DAILY REPORTS ===")
print(f"📌 Cash (Naqd): {report['cash']:,} so'm")
print(f"📌 Card (Karta): {report['card']:,} so'm")
print(f"📌 Click: {report['click']:,} so'm")
print(f"📌 Sum of Paid (Cash+Card+Click): {report['cash'] + report['card'] + report['click']:,} so'm")
print(f"📌 Total Income (Report total_income): {report['total_income']:,} so'm")
print(f"📌 Difference (Unpaid added?): {report['total_income'] - (report['cash'] + report['card'] + report['click']):,} so'm")

print("\n--- Admin Dashboard Summary ---")
print(f"📌 total_income: {admin_summary['total_income']:,} so'm")

print("\n--- Admin Daily Report ---")
print(f"📌 total_income: {daily_adm.get('total_income', 0):,} so'm")
