import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.transaction import Transaction
from models.provider import Provider

db = SessionLocal()
today_str = date.today().isoformat()

doc = db.query(Provider).filter(Provider.full_name.ilike("%g'anijon%")).first()

print(f"=== DR. G'ANIJON HAMMA BEMORLARI (2026-08-18) ===")
print(f"Provider ID: {doc.id}, Name: {doc.full_name}, Percentage: {doc.percentage}%, Current Balance: {doc.balance:,} so'm".replace(",", " "))

pats = db.query(Patient).filter(Patient.is_cancelled == False, Patient.provider_id == doc.id).all()
today_pats = [p for p in pats if p.created_at and p.created_at.isoformat()[:10] == today_str]

print(f"\nJami Dr. G'anijonga biriktirilgan bemorlar soni: {len(today_pats)} ta\n")

total_paid = 0
total_earned = 0

for idx, p in enumerate(today_pats, 1):
    paid = p.payment_amount or 0
    total_paid += paid
    
    tx = db.query(Transaction).filter(Transaction.patient_id == p.id, Transaction.is_cancelled == False).first()
    doc_share = tx.provider_amount if tx else int(paid * doc.percentage / 100)
    total_earned += doc_share
    
    svc_name = p.service.name if p.service else "Xizmat"
    svc_cat = p.service.category if p.service else "Toifa"
    print(f"  {idx}. Bemor: {p.first_name} {p.last_name} | {svc_name} (Toifa: {svc_cat}) | To'lov: {paid:,} so'm | Shifokor ulushi: {doc_share:,} so'm".replace(",", " "))

print(f"\n==================================================")
print(f"JAMI DR. G'ANIJON BEMORLARI TO'LOVI: {total_paid:,} so'm".replace(",", " "))
print(f"JAMI DR. G'ANIJON ISHLAGAN ULUSHI (50%): {total_earned:,} so'm".replace(",", " "))
print(f"BAZADAGI HOZIRGI BALANSI (doc.balance): {doc.balance:,} so'm".replace(",", " "))
