# --- QALQON: JONLI BAZAGA ULANISHNI TAQIQLAYDI -------------------------
# 2026-08-20: bu skript qalqonsiz edi va jonli bazadan o'qirdi. Bundan
# tashqari "karta jami 150,000 bo'lsin" deb QAT'IY raqamga bog'langan edi -
# ya'ni faqat yozilgan kunidagi ma'lumotda ishlardi, ertasiga esa doim
# yiqilardi. Endi o'z yozuvini yaratib, FARQNI tekshiradi.
import os as _os
import sys as _sys
if not _os.environ.get("DATABASE_URL", "").startswith("sqlite"):
    _sys.exit("TO'XTATILDI: test skripti jonli bazada ishlamaydi. "
              "DATABASE_URL sqlite:/// bilan boshlanishi shart.")
# ----------------------------------------------------------------------

import sys, io, uuid
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import date
from database import SessionLocal
from models.patient import Patient
from models.service import Service
from models.transaction import Transaction
from services.reports_data import get_report, admin_dashboard_summary

db = SessionLocal()
bugun = date.today()

print("=== NASIYA TO'LOV KARTA JAMISIGA QO'SHILMASLIGI TEKSHIRUVI ===")

svc = db.query(Service).filter(Service.is_active == True).first()
assert svc, "Bazada faol xizmat yo'q"

KARTA = 150_000
NASIYA = 120_000

oldin = get_report(db, bugun, bugun)
oldin_xulosa = admin_dashboard_summary(db, bugun)
print("   oldin:  karta=%s  tushum=%s" % (
    f"{oldin['card']:,}", f"{oldin['total_income']:,}"))

yaratilgan = []


def bemor_qosh(tolov_turi, summa, karta=0):
    p = Patient(
        first_name="KartaSinov",
        last_name=tolov_turi.capitalize(),
        birth_date=date(1990, 1, 1),
        phone=f"+99890{uuid.uuid4().int % 10000000:07d}",
        address="Sinov",
        service_id=svc.id,
        payment_amount=summa,
        payment_type=tolov_turi,
        card_amount=karta,
        created_by=1,
    )
    db.add(p)
    db.flush()
    t = Transaction(
        patient_id=p.id,
        total_amount=summa,
        center_amount=summa,
        provider_amount=0,
        referrer_amount=0,
        payment_type=tolov_turi,
        card_amount=karta,
    )
    db.add(t)
    db.commit()
    yaratilgan.append((p.id, t.id))
    return p


try:
    bemor_qosh("card", KARTA, karta=KARTA)
    bemor_qosh("later", NASIYA)   # nasiya - hali to'lanmagan

    keyin = get_report(db, bugun, bugun)
    keyin_xulosa = admin_dashboard_summary(db, bugun)
    print("   keyin:  karta=%s  tushum=%s" % (
        f"{keyin['card']:,}", f"{keyin['total_income']:,}"))

    karta_farqi = keyin["card"] - oldin["card"]
    xulosa_farqi = keyin_xulosa["card"] - oldin_xulosa["card"]

    print()
    print("   karta o'sishi (hisobot):     %s   kutilgan %s" % (
        f"{karta_farqi:,}", f"{KARTA:,}"))
    print("   karta o'sishi (bosh sahifa): %s   kutilgan %s" % (
        f"{xulosa_farqi:,}", f"{KARTA:,}"))

    assert karta_farqi == KARTA, (
        f"Karta jamisi {KARTA:,} ga oshishi kerak edi, {karta_farqi:,} oshdi - "
        f"nasiya kartaga qo'shilyapti")
    assert xulosa_farqi == KARTA, (
        f"Bosh sahifada karta {KARTA:,} ga oshishi kerak edi, "
        f"{xulosa_farqi:,} oshdi")

    print("\nO'TDI: nasiya (later) to'lov karta jamisiga qo'shilmadi.")
finally:
    # Tozalash - sinov yozuvlari qolib ketmasin
    for pid, tid in yaratilgan:
        db.query(Transaction).filter(Transaction.id == tid).delete()
        db.query(Patient).filter(Patient.id == pid).delete()
    db.commit()
    print("   sinov yozuvlari tozalandi (%d ta)" % len(yaratilgan))
