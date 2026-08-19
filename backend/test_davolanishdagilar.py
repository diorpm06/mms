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
from routers.courses import _kurslarni_yig, _tozala

db = SessionLocal()

print("=== DAVOLANISHDAGILAR (OLDINDAN TO'LANGAN KURSLAR) BO'LIMI ===")
raw = _kurslarni_yig(db, faqat_tugallanmagan=True)
courses = [_tozala(g) for g in raw]

print(f"📌 Davolanishdagilar bo'limida hozir turgan jami bemorlar: {len(courses)} ta\n")

for idx, c in enumerate(courses, 1):
    print(f"{idx}. Bemor: {c['patient_name']} | Tel: {c['phone'] or '—'}")
    print(f"   • Jami qolgan kun: {c['total_remaining']} kun")
    print(f"   • Boshlangan sana: {c['started_at']}")
    print(f"   • Xizmatlar ro'yxati:")
    for s in c['services']:
        print(f"      - {s['service_name']} [{s['category']}]: {s['quantity']} kunlik kurs ({s['used_count']} kuni o'tildi, {s['remaining']} kun qoldi) — Jami: {s['total_price']:,} so'm".replace(",", " "))
    print()
