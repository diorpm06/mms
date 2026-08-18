import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.provider import Provider
from models.service import Service
from models.patient import Patient
from datetime import date

db = SessionLocal()
today_str = date.today().isoformat()

print("=== BARCHA SHIFOKORLAR / PROVIDERLAR ===")
provs = db.query(Provider).all()
for pr in provs:
    pats = db.query(Patient).filter(Patient.is_cancelled == False, Patient.provider_id == pr.id).all()
    today_pats = [p for p in pats if p.created_at and p.created_at.isoformat()[:10] == today_str]
    print(f"ID: {pr.id} | {pr.full_name} | Bugun: {len(today_pats)} ta bemor")
    for p in today_pats:
        print(f"   • {p.first_name} {p.last_name} ({p.service.name if p.service else '—'})")

print("\n=== UZI NOMIDAGI YOKI UZI TOIFASIDAGI XIZMATLAR ===")
svcs = db.query(Service).all()
for s in svcs:
    c = (s.category or "").lower()
    n = (s.name or "").lower()
    if "uzi" in c or "uzi" in n or "ultratovush" in c or "ultrazvuk" in c or "ultrazvuk" in n:
        print(f"ID: {s.id} | Name: '{s.name}' | Category: '{s.category}' | Cabinet: '{s.cabinet}'")
