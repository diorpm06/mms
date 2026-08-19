# --- QALQON: JONLI BAZAGA ULANISHNI TAQIQLAYDI -------------------------
# 2026-08-19: bu test skripti qalqonsiz edi va jonli Supabase bazasida
# haqiqiy bemor yozuvlari yaratgan (21 ta topilib o'chirildi). Tozalash
# qismi ham yo'q edi. Endi faqat vaqtinchalik SQLite bazada ishlaydi:
#   $env:DATABASE_URL='sqlite:///C:/Temp/sinov.db'
import os as _os
import sys as _sys
if not _os.environ.get("DATABASE_URL", "").startswith("sqlite"):
    _sys.exit("TO'XTATILDI: test skripti jonli bazada ishlamaydi. "
              "DATABASE_URL sqlite:/// bilan boshlanishi shart.")
# ----------------------------------------------------------------------


import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from services.reports_data import ten_day_report

db = SessionLocal()
today = date.today()

report = ten_day_report(db, today, today)

print("=== TEKSHIRILGAN 10-KUNLIK HISOBOT (REFERRERS PAYOUT) ===")
for r in report.get("referrers_payout", []):
    print(f"• {r['name']}:")
    print(f"   - Bemorlar soni: {r['patient_count']} nafar")
    print(f"   - Jami tushum (Gross): {r['gross_total']:,} so'm".replace(",", " "))
    print(f"   - Ishlangan ulush (Earned Fee): {r['earned_commission']:,} so'm".replace(",", " "))
    print(f"   - Sof to'lanadigan: {r['net_payable']:,} so'm".replace(",", " "))

print(f"\n==========================================")
print(f"JAMI HISOBLANGAN ULUSH: {sum(r['earned_commission'] for r in report.get('referrers_payout', [])):,} so'm".replace(",", " "))
