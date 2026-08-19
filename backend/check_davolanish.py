
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.patient import Patient
from models.service import Service

db = SessionLocal()

print("=== 1. SERVICES WITH CATEGORY OR NAME 'Davolanish' ===")
svcs = db.query(Service).all()
dav_svcs = [s for s in svcs if "davola" in (s.category or "").lower() or "davola" in (s.name or "").lower()]
print(f"Topilgan xizmatlar: {len(dav_svcs)}")
for s in dav_svcs:
    print(f"  • Service #{s.id} | Name: {s.name} | Category: {s.category} | Price: {s.price:,} so'm".replace(",", " "))

print("\n=== 2. PATIENTS IN 'Davolanish' CATEGORY ===")
pats = db.query(Patient).filter(Patient.is_cancelled == False).all()
dav_pats = []
for p in pats:
    svc_cat = (p.service.category if p.service else "").lower()
    svc_name = (p.service.name if p.service else "").lower()
    if "davola" in svc_cat or "davola" in svc_name:
        dav_pats.append(p)

print(f"Davolanish bo'limidagi jami bemorlar: {len(dav_pats)} ta\n")
for p in dav_pats[:20]:
    dt = p.created_at.strftime("%d.%m.%Y %H:%M") if p.created_at else "—"
    svc_str = p.service.name if p.service else "—"
    cat_str = p.service.category if p.service else "—"
    prov_str = p.provider.full_name if p.provider else "—"
    print(f"  • Bemor #{p.id}: {p.first_name} {p.last_name} | {svc_str} [{cat_str}] | To'lov: {p.payment_amount:,} so'm | Shifokor: {prov_str} | Sana: {dt}".replace(",", " "))

# Check if there are courses routers/tables in the project
try:
    from models.course import Course
    courses = db.query(Course).all()
    print(f"\n=== 3. COURSES TABLE ('courses') ===")
    print(f"Jami kurslar: {len(courses)}")
    for c in courses[:10]:
        print(f"  • Course #{c.id} | Patient: {c.patient_name} | Total: {c.total_amount:,} so'm | Paid: {c.paid_amount:,} so'm".replace(",", " "))
except Exception as e:
    print(f"\nCourse modeli topilmadi: {e}")
