
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from routers.courses import get_courses_list

db = SessionLocal()

print("=== BACKEND /api/courses NOG’ORASIDAGI 'DAVOLANISHDAGILAR' BO'LIMINI TEKSHIRISH ===")

try:
    res = get_courses_list(db=db)
    print(f"📌 'Davolanishdagilar' bo'limida hozir turgan bemorlar (kurslar) soni: {len(res)} ta\n")
    
    for idx, r in enumerate(res, 1):
        print(f"{idx}. Bemor: {r['patient_name']} ({r['phone'] or '—'})")
        print(f"   • Jami qolgan kunlar: {r['total_remaining']} kun")
        print(f"   • Boshlangan sana: {r['started_at']}")
        print(f"   • Xizmatlari:")
        for s in r['services']:
            print(f"      - {s['service_name']}: {s['quantity']} kundan {s['used_count']} ta kuni o'tildi, {s['remaining']} kun qoldi")
        print()
except Exception as e:
    import traceback
    traceback.print_exc()
