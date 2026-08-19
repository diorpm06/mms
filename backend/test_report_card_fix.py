import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from services.reports_data import get_report, admin_dashboard_summary

db = SessionLocal()
today = date.today()

report = get_report(db, today, today)
admin_summary = admin_dashboard_summary(db, today)

print("=== REPORT CARD FIX VERIFICATION RESULT ===")
print(f"📌 Daily Report Card Total: {report['card']:,} so'm")
print(f"📌 Daily Report Cash Total: {report['cash']:,} so'm")
print(f"📌 Daily Report Click Total: {report['click']:,} so'm")

print(f"\n📌 Admin Dashboard Summary Card Total: {admin_summary['card']:,} so'm")
print(f"📌 Admin Dashboard Summary Cash Total: {admin_summary['cash']:,} so'm")

assert report['card'] == 150000, f"Expected 150,000 so'm for card, got {report['card']:,}"
assert admin_summary['card'] == 150000, f"Expected 150,000 so'm for card in admin summary, got {admin_summary['card']:,}"

print("\n✅ VERIFICATION SUCCESSFUL: Card total is strictly 150,000 so'm! Later/Nasiya payments are NO LONGER incorrectly added to Card!")
