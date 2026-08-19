import sys, io, uuid
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.patient_service import PatientService
from models.service import Service
from routers.courses import _kurslarni_yig

db = SessionLocal()

print("=== VERIFICATION TEST: Single-Visit 5 Units MUST NOT Split Into 5 Days ===")

svc = db.query(Service).filter(Service.is_active == True).first()
if not svc:
    print("❌ Service not found")
    sys.exit(1)

test_phone = f"+99890{uuid.uuid4().int % 10000000:07d}"

# Patient gets 5 units of Hijoma TODAY (Single visit today, NOT a multi-day course)
p = Patient(
    first_name="SingleVisit5Units",
    last_name="TestNoCourse",
    birth_date=date(1991, 1, 1),
    phone=test_phone,
    address="Tashkent",
    service_id=svc.id,
    payment_amount=svc.price * 5,
    payment_type="cash",
    created_by=1,
)
db.add(p)
db.flush()

ps = PatientService(
    patient_id=p.id,
    service_id=svc.id,
    quantity=5,
    unit_price=svc.price,
    total_price=svc.price * 5,
    is_course=False,  # NOT a multi-day course!
)
db.add(ps)
db.commit()

# Check courses list
courses = _kurslarni_yig(db, faqat_tugallanmagan=True)
c_found = [c for c in courses if c["phone"] == test_phone]

print(f"📌 Davolanishdagilar bo'limida ko'ringanlar soni: {len(c_found)}")
assert len(c_found) == 0, "STRICT FAILURE: Single visit with 5 units MUST NOT be in Davolanishdagilar!"

print("✅ VERIFICATION SUCCESSFUL: 5 units in a single visit today correctly stays as 1 visit today and does NOT split into 5 days!")

# Cleanup
p.is_cancelled = True
db.commit()
print("✓ Cleanup done.")
