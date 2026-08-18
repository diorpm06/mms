import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.provider import Provider
from models.referrer import Referrer
from models.transaction import Transaction
from services.finance import get_referrer_rates_for_service, main_category

db = SessionLocal()
today_str = date.today().isoformat()

def direct_split(total: int, prov_pct: int, ref_pct: int | None, ref_sum: int | None, is_uzi: bool = False, original_price: int | None = None):
    ref_amt = 0
    if ref_sum and ref_sum > 0:
        ref_amt = int(ref_sum)
    elif ref_pct:
        ref_amt = int(total * ref_pct / 100)

    if is_uzi:
        has_discount = original_price is not None and total < original_price
        clinic_fixed_fee = 0 if has_discount else 10000
        remaining = max(0, total - clinic_fixed_fee)
        pct = prov_pct if prov_pct > 0 else 50
        prov_amt = int(remaining * pct / 100)
    else:
        prov_amt = int(total * prov_pct / 100)

    center_amt = total - ref_amt - prov_amt
    return ref_amt, prov_amt, center_amt

print("=== TO'G'RIDAN-TO'G'RI TAQSIMOT (DIRECT SPLIT) BO'YICHA TEKSHIRUV (2026-08-18) ===\n")

# Re-evaluate all today transactions
today_txs = db.query(Transaction).filter(Transaction.is_cancelled == False).all()
today_txs = [t for t in today_txs if t.created_at and t.created_at.isoformat()[:10] == today_str]

prov_totals = {}
for t in today_txs:
    p = db.query(Patient).filter(Patient.id == t.patient_id).first()
    if not p:
        continue
    
    prov = p.provider
    ref = p.referrer
    svc = p.service
    
    prov_pct = prov.percentage if prov else 0
    ref_pct, ref_sum = get_referrer_rates_for_service(ref, svc, db) if ref else (0, 0)
    is_uzi = main_category(svc.category).lower().startswith("uzi") if svc else False
    
    r_amt, p_amt, c_amt = direct_split(
        total=p.payment_amount or 0,
        prov_pct=prov_pct,
        ref_pct=ref_pct,
        ref_sum=ref_sum,
        is_uzi=is_uzi,
        original_price=svc.price if svc else p.payment_amount
    )
    
    if prov:
        prov_totals[prov.full_name] = prov_totals.get(prov.full_name, 0) + p_amt

print("👨‍⚕️ BUGUNGI SHIFOKORLAR ULUSHI (TO'G'RIDAN-TO'G'RI FOIZ BO'YICHA):")
for p_name, p_tot in prov_totals.items():
    print(f"  • {p_name}: {p_tot:,} so'm".replace(",", " "))
