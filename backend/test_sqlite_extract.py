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

from database import SessionLocal
from models.expense import Expense
from sqlalchemy import extract, func

db = SessionLocal()

print("=== ALL EXPENSES IN DB WITH CREATED_AT ===")
for e in db.query(Expense).all():
    print(f"ID #{e.id} | Amount: {e.amount} | created_at: {e.created_at} | type: {type(e.created_at)}")

print("\n--- Testing SQLAlchemy extract vs strftime in SQLite ---")

res_extract = db.query(Expense).filter(
    extract("year", Expense.created_at) == 2026,
    extract("month", Expense.created_at) == 8,
).all()
print(f"extract('year')==2026 and extract('month')==8 count: {len(res_extract)}")
for e in res_extract:
    print(f"  -> ID #{e.id} | {e.description} | {e.amount}")

res_strftime = db.query(Expense).filter(
    func.strftime("%Y", Expense.created_at) == "2026",
    func.strftime("%m", Expense.created_at) == "08",
).all()
print(f"\nstrftime('%Y')=='2026' and strftime('%m')=='08' count: {len(res_strftime)}")
for e in res_strftime:
    print(f"  -> ID #{e.id} | {e.description} | {e.amount}")
