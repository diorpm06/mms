
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.service_category import ServiceCategory
from models.service import Service
from models.patient import Patient
from models.inpatient import Inpatient

db = SessionLocal()

print("=== 1. SERVICE CATEGORIES TABLE (service_categories) ===")
scs = db.query(ServiceCategory).all()
print(f"Jami service_categories: {len(scs)}")
for sc in scs:
    print(f"  • ID #{sc.id} | Name: {sc.name} | CommissionMode: {sc.commission_mode} | Val: {sc.commission_value}")

print("\n=== 2. PATIENTS WITH DIAGNOSIS / COMPLAINTS / ADDRESS / NOTES LIKE 'davola' ===")
pats = db.query(Patient).filter(Patient.is_cancelled == False).all()
match_pats = []
for p in pats:
    diag = (p.diagnosis or "").lower()
    comp = (p.complaints or "").lower()
    addr = (p.address or "").lower()
    fname = (p.first_name or "").lower()
    lname = (p.last_name or "").lower()
    if any("davol" in x for x in [diag, comp, addr, fname, lname]):
        match_pats.append(p)

print(f"Tashxis/Izohida 'davola' so'zi bor bemorlar: {len(match_pats)} ta")
for p in match_pats:
    svc_name = p.service.name if p.service else "—"
    print(f"  • Bemor #{p.id}: {p.first_name} {p.last_name} | Service: {svc_name} | Diag: {p.diagnosis} | Comp: {p.complaints}")

print("\n=== 3. STATSIONAR (INPATIENTS) TABLE ===")
inpats = db.query(Inpatient).filter(Inpatient.is_cancelled == False).all()
print(f"Statsionarda yotgan jami bemorlar: {len(inpats)} ta")
for ip in inpats:
    print(f"  • ID #{ip.id}: {ip.first_name} {ip.last_name} | Room: {ip.room_number} | Rate: {ip.daily_rate:,} | Status: {ip.status} | Diag: {ip.diagnosis}".replace(",", " "))
