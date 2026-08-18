import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from services.reports_data import daily_report, ten_day_report
from services.export import export_pdf, export_referrers_pdf

db = SessionLocal()

print("=== PDF HISOBOX METODLARINI TEKSHIRISH ===")

try:
    print("1. Kunlik hisobot ma'lumotlarini olish...")
    rep = daily_report(db, date.today())
    print("   ✓ daily_report olindi.")
    
    print("2. export_pdf(rep) ni chaqirish...")
    pdf_bytes = export_pdf(rep, title="Kunlik Hisobot Test")
    print(f"   ✓ export_pdf muvaffaqiyatli ishladil! PDF hajmi: {len(pdf_bytes)} bayt")
except Exception as e:
    import traceback
    print("   ❌ XATOLIK export_pdf da:")
    traceback.print_exc()

print("\n--------------------------------------------------\n")

try:
    print("3. 10 kunlik / Referrers hisobot ma'lumotlarini olish...")
    rep10 = ten_day_report(db, date.today(), date.today())
    print("   ✓ ten_day_report olindi.")
    
    print("4. export_referrers_pdf(rep10) ni chaqirish...")
    pdf_bytes_ref = export_referrers_pdf(rep10)
    print(f"   ✓ export_referrers_pdf muvaffaqiyatli ishladil! PDF hajmi: {len(pdf_bytes_ref)} bayt")
except Exception as e:
    import traceback
    print("   ❌ XATOLIK export_referrers_pdf da:")
    traceback.print_exc()
