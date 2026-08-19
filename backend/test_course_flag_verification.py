import sys, io, uuid
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.patient_service import PatientService
from models.service import Service
from routers.courses import _kurslarni_yig

db = SessionLocal()

print("=== VERIFICATION TEST: Single-Visit Quantity vs Multi-Day Course Flag ===")

svc = db.query(Service).filter(Service.is_active == True).first()
if not svc:
    print("❌ Xizmat topilmadi")
    sys.exit(1)

# Test 1: Patient with quantity=10, is_course=False (e.g., 10 Xijoma in 1 visit today)
p1 = Patient(
    first_name="TestSingleVisit",
    last_name="Quantity10",
    birth_date=date(1990, 1, 1),
    phone="+998901119999",
    address="Test",
    service_id=svc.id,
    payment_amount=svc.price * 10,
    payment_type="cash",
    created_by=1,
)
db.add(p1)
db.flush()

ps1 = PatientService(
    patient_id=p1.id,
    service_id=svc.id,
    quantity=10,
    unit_price=svc.price,
    total_price=svc.price * 10,
    is_course=False,  # Single-visit 10 units!
)
db.add(ps1)

# Test 2: Patient with quantity=5, is_course=True (5-day course)
p2 = Patient(
    first_name="TestMultiDay",
    last_name="Course5",
    birth_date=date(1992, 2, 2),
    phone="+998902228888",
    address="Test",
    service_id=svc.id,
    payment_amount=svc.price * 5,
    payment_type="cash",
    created_by=1,
)
db.add(p2)
db.flush()

ps2 = PatientService(
    patient_id=p2.id,
    service_id=svc.id,
    quantity=5,
    unit_price=svc.price,
    total_price=svc.price * 5,
    is_course=True,  # Multi-day course!
)
db.add(ps2)

db.commit()

# Now run _kurslarni_yig
courses = _kurslarni_yig(db, faqat_tugallanmagan=True)

course_names = [c["patient_name"] for c in courses]

print(f"📌 Davolanishdagilar bo'limida ko'ringan bemorlar:")
for name in course_names:
    print(f"  • {name}")

# Assertions
assert "TestSingleVisit Quantity10" not in course_names, "ERROR: Single-visit quantity=10 should NOT be in Davolanishdagilar!"
assert "TestMultiDay Course5" in course_names, "ERROR: Multi-day course (is_course=True) MUST be in Davolanishdagilar!"

print("\n✅ VERIFICATION SUCCESSFUL! Single-visit quantity=10 stays in today's visit, while is_course=True goes to Davolanishdagilar!")

# Clean up test records
p1.is_cancelled = True
p2.is_cancelled = True
db.commit()
print("✓ Test yozuvlari tozalandi.")
