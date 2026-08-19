import sys, io, uuid
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.patient_service import PatientService
from models.service import Service
from routers.courses import _kurslarni_yig, _odam_kaliti

db = SessionLocal()

print("=== VERIFICATION TEST: EDIT COURSE DAYS ENDPOINT ===")

svc = db.query(Service).filter(Service.is_active == True).first()
if not svc:
    print("❌ Service not found")
    sys.exit(1)

test_phone = f"+99890{uuid.uuid4().int % 10000000:07d}"

# Create a test course patient with 3 days
p = Patient(
    first_name="EditCourse",
    last_name="TestPatient",
    birth_date=date(1995, 5, 5),
    phone=test_phone,
    address="Test City",
    service_id=svc.id,
    payment_amount=svc.price * 3,
    payment_type="cash",
    created_by=1,
)
db.add(p)
db.flush()

ps = PatientService(
    patient_id=p.id,
    service_id=svc.id,
    quantity=3,
    used_count=1,
    unit_price=svc.price,
    total_price=svc.price * 3,
    is_course=True,
)
db.add(ps)
db.commit()

# Query initial course list
courses_before = _kurslarni_yig(db, faqat_tugallanmagan=True)
c_found = [c for c in courses_before if c["phone"] == test_phone]
assert len(c_found) == 1, f"Course patient should exist in courses list (found {len(c_found)})"
course_key = c_found[0]["key"]

print(f"✓ Found initial course: {course_key}, remaining: {c_found[0]['total_remaining']} days")
assert c_found[0]['total_remaining'] == 2, "3 total - 1 used = 2 remaining"

# Perform edit (increase days to 7, used_count to 3)
ps.quantity = 7
ps.used_count = 3
ps.total_price = ps.unit_price * 7
db.commit()

# Query updated course list
courses_after = _kurslarni_yig(db, faqat_tugallanmagan=True)
c_after = [c for c in courses_after if c["phone"] == test_phone][0]

print(f"✓ After edit: total quantity={c_after['services'][0]['quantity']}, used={c_after['services'][0]['used_count']}, remaining={c_after['total_remaining']}")
assert c_after['services'][0]['quantity'] == 7, "Quantity should be updated to 7"
assert c_after['services'][0]['used_count'] == 3, "Used count should be updated to 3"
assert c_after['total_remaining'] == 4, "7 total - 3 used = 4 remaining"

print("✅ EDIT COURSE VERIFICATION SUCCESSFUL!")

# Cleanup
p.is_cancelled = True
db.commit()
print("✓ Cleanup finished.")
