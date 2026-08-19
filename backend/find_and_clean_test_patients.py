
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.patient import Patient
from models.patient_service import PatientService
from models.service import Service

db = SessionLocal()

print("=== FINDING ALL TEST PATIENT RECORDS IN DATABASE ===")

test_patients = (
    db.query(Patient)
    .filter(
        (Patient.first_name.ilike("%test%")) |
        (Patient.last_name.ilike("%test%")) |
        (Patient.first_name.ilike("%singlevisit%")) |
        (Patient.first_name.ilike("%editcourse%")) |
        (Patient.first_name.ilike("%financetest%"))
    )
    .order_by(Patient.id.desc())
    .all()
)

print(f"📌 Topilgan jami 'Test' bemorlar yozuvi soni: {len(test_patients)} ta\n")

for p in test_patients:
    ps_rows = db.query(PatientService).filter(PatientService.patient_id == p.id).all()
    svcs = []
    for ps in ps_rows:
        s = db.query(Service).filter(Service.id == ps.service_id).first()
        svcs.append(s.name if s else f"ID:{ps.service_id}")
    s_str = ", ".join(svcs) if svcs else "Xizmat yo'q"
    sana_str = p.created_at.strftime("%d.%m.%Y %H:%M") if p.created_at else "—"
    status_str = "BEKOR QILINGAN" if p.is_cancelled else "FAOL"
    print(f"  • ID: {p.id} | [{sana_str}] | {p.first_name} {p.last_name} ({p.phone or 'Tel yo-q'})")
    print(f"    - Holati: {status_str} | Summa: {p.payment_amount:,} so'm | Xizmat: {s_str}")
    print()

# Soft-cancel or hard-delete option:
# Mark all test patients as is_cancelled = True so they don't affect revenue/analytics
cancelled_count = 0
for p in test_patients:
    if not p.is_cancelled:
        p.is_cancelled = True
        cancelled_count += 1

if cancelled_count > 0:
        db.commit()
        print(f"✅ {cancelled_count} ta faol 'Test' yozuv bekor qilindi (is_cancelled = True). Endi hisobotlarga ta'sir qilmaydi.")
else:
    print("✓ Barcha test yozuvlari allaqachon bekor qilingan edi (is_cancelled = True).")
