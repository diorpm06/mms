import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models.patient import Patient
from models.provider import Provider
from models.transaction import Transaction
from services.finance import reprice_patient_payment

db = SessionLocal()

# Search patients with service named Ultrazvuk today
pats = db.query(Patient).filter(Patient.is_cancelled == False).all()
for p in pats:
    svc_name = p.service.name if p.service else ""
    if "ultrazvuk" in svc_name.lower():
        print(f"ID: {p.id} | Bemor: {p.first_name} {p.last_name} | Service: {svc_name} | Provider: {p.provider.full_name if p.provider else 'None'}")
        
        # If assigned to Dr G'anijon, reassign to Dr Yulduz!
        if p.provider and "g'anijon" in p.provider.full_name.lower():
            dr_yulduz = db.query(Provider).filter(Provider.full_name.ilike("%yulduz%")).first()
            if dr_yulduz:
                print(f"  --> O'tkazilmoqda Dr Yulduz (ID {dr_yulduz.id}) ga...")
                p.provider_id = dr_yulduz.id
                tx = db.query(Transaction).filter(Transaction.patient_id == p.id, Transaction.is_cancelled == False).first()
                if tx:
                    reprice_patient_payment(db, p, tx)

db.commit()

dr_ganijon = db.query(Provider).filter(Provider.full_name.ilike("%g'anijon%")).first()
dr_yulduz = db.query(Provider).filter(Provider.full_name.ilike("%yulduz%")).first()

print(f"\n=== TUZATISHDAN KEYINGI SHIFOKOR BALANSLARI ===")
print(f"• Dr. G'anijon (Massaj) balansi: {dr_ganijon.balance:,} so'm".replace(",", " "))
print(f"• Dr. Yulduz (Fizioterapiya) balansi: {dr_yulduz.balance:,} so'm".replace(",", " "))
