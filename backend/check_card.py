from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.inpatient import InpatientPayment

db = SessionLocal()
today_str = date.today().isoformat()

# 1. Ambulator (Bugungi barcha bemorlar)
patients = db.query(Patient).filter(
    Patient.is_cancelled == False
).all()

today_pats = [p for p in patients if p.created_at and p.created_at.isoformat()[:10] == today_str]

card_pats = [p for p in today_pats if (p.payment_type or '').lower() in ['card', 'karta']]
split_card_pats = [p for p in today_pats if (p.payment_type or '').lower() == 'split' and (p.card_amount or 0) > 0]
click_pats = [p for p in today_pats if (p.payment_type or '').lower() == 'click']
qr_pats = [p for p in today_pats if (p.payment_type or '').lower() == 'qr']

# 2. Statsionar to'lovlar
inp_payments = db.query(InpatientPayment).filter(
    InpatientPayment.is_cancelled == False
).all()

today_inp_payments = [p for p in inp_payments if p.created_at and p.created_at.isoformat()[:10] == today_str]
inp_card = [p for p in today_inp_payments if (p.payment_type or '').lower() in ['card', 'karta']]
inp_click = [p for p in today_inp_payments if (p.payment_type or '').lower() == 'click']
inp_qr = [p for p in today_inp_payments if (p.payment_type or '').lower() == 'qr']

print("=== BUGUNGI KARTA TO'LOVLARI (2026-08-18) ===")
print(f"Ambulator Karta to'lovlar soni: {len(card_pats)} ta, Summa: {sum(p.payment_amount or 0 for p in card_pats):,} so'm")
for p in card_pats:
    svc_str = p.service.name if getattr(p, 'service', None) else 'Xizmat'
    print(f"  - {p.first_name} {p.last_name}: {p.payment_amount:,} so'm ({svc_str})")

if split_card_pats:
    print(f"Ambulator Aralash (Karta qismi): {len(split_card_pats)} ta, Summa: {sum(p.card_amount or 0 for p in split_card_pats):,} so'm")

print(f"Statsionar Karta to'lovlar soni: {len(inp_card)} ta, Summa: {sum(p.amount or 0 for p in inp_card):,} so'm")
for p in inp_card:
    print(f"  - To'lov #{p.id}: {p.amount:,} so'm")

print(f"Click to'lovlar: {len(click_pats) + len(inp_click)} ta")
print(f"QR to'lovlar: {len(qr_pats) + len(inp_qr)} ta")

total_card_count = len(card_pats) + len(split_card_pats) + len(inp_card)
total_card_sum = sum(p.payment_amount or 0 for p in card_pats) + sum(p.card_amount or 0 for p in split_card_pats) + sum(p.amount or 0 for p in inp_card)

print(f"\nJAMI KARTA TO'LOVLARI SONI: {total_card_count} ta")
print(f"JAMI KARTA SUMMASI: {total_card_sum:,} so'm".replace(",", " "))
