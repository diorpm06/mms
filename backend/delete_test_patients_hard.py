
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.patient import Patient
from models.patient_service import PatientService

db = SessionLocal()

print("=== HARD DELETING ALL TEST PATIENT RECORDS FROM DB ===")

test_ids = [608, 609, 610]

for pid in test_ids:
    db.query(PatientService).filter(PatientService.patient_id == pid).delete()
    p = db.query(Patient).filter(Patient.id == pid).first()
    if p:
        db.delete(p)
        print(f"  • Deleted Patient ID: {pid} ({p.first_name} {p.last_name})")

db.commit()
print("✅ SUCCESS: All test patient records permanently removed from database!")
