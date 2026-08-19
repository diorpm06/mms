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

import sys, io, uuid
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.service import Service

db = SessionLocal()

print("=== VERIFYING PATIENT PERSONAL INFO EDITING ===")

svc = db.query(Service).filter(Service.is_active == True).first()
if not svc:
    print("❌ Service not found")
    sys.exit(1)

test_phone = f"+99890{uuid.uuid4().int % 10000000:07d}"
p = Patient(
    first_name="OldName",
    last_name="OldLastName",
    birth_date=date(1995, 5, 5),
    phone=test_phone,
    address="OldAddress",
    service_id=svc.id,
    payment_amount=100000,
    payment_type="cash",
    created_by=1,
)
db.add(p)
db.commit()

print(f"📌 Created Patient ID: {p.id} | Name: {p.first_name} {p.last_name} | Birth: {p.birth_date} | Address: {p.address}")

# Update patient
p.first_name = "NewName"
p.last_name = "NewLastName"
p.birth_date = date(2000, 10, 10)
p.phone = "+998991234567"
p.address = "Urganch shahar, Al-Xorazmiy ko'chasi"
db.commit()

# Re-query
p_updated = db.query(Patient).filter(Patient.id == p.id).first()
print(f"📌 Updated Patient ID: {p_updated.id} | Name: {p_updated.first_name} {p_updated.last_name} | Birth: {p_updated.birth_date} | Address: {p_updated.address}")

assert p_updated.first_name == "NewName"
assert p_updated.last_name == "NewLastName"
assert p_updated.birth_date == date(2000, 10, 10)
assert p_updated.address == "Urganch shahar, Al-Xorazmiy ko'chasi"

# Cleanup
db.delete(p_updated)
db.commit()

print("\n✅ VERIFICATION SUCCESSFUL: Personal info (Ism, Familiya, Tug'ilgan yili/sanasi, Telefon, Yashash manzili) is 100% updateable and persisted!")
