
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.service import Service
from models.patient import Patient

db = SessionLocal()

print("=== BAZADAGI XIZMAT KATEGORIYALARI (Service.category) ===")
categories = db.query(Service.category).distinct().all()
for c in categories:
    print(f"  • Category: {c[0]}")

print("\n=== BAZADAGI XIZMATLAR NOMI VA KATEGORIYALARI ===")
svcs = db.query(Service).all()
for s in svcs:
    print(f"  • ID #{s.id} | {s.name} | Category: {s.category} | Price: {s.price:,} so'm".replace(",", " "))

print("\n=== BEMORLAR DAGI KATEGORIYALAR (Patient -> Service -> category) ===")
pats = db.query(Patient).filter(Patient.is_cancelled == False).all()
pat_cats = set(p.service.category for p in pats if p.service)
for pc in pat_cats:
    print(f"  • {pc}")
