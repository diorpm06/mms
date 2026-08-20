"""patient_services.course_days ustunini qo'shadi.

DIQQAT: bu ustun MATN bo'lishi shart — ichida "1,3,5" kabi kunlar ro'yxati
saqlanadi. Ilgari bu skript uni INTEGER qilib yaratgan edi va natijada
20.08 kuni bemor ro'yxatga olib bo'lmay qoldi:

    column "course_days" is of type integer but expression is of type
    character varying

Har bir bemor qo'shishda patient_services jadvaliga yozuv tushadi, shu
sababli xato butun ro'yxatga olishni to'xtatib qo'ygan edi.
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import engine
from sqlalchemy import text

print("=== patient_services.course_days ustuni (VARCHAR 200) ===")

with engine.connect() as conn:
    try:
        conn.execute(text(
            "ALTER TABLE patient_services "
            "ADD COLUMN IF NOT EXISTS course_days VARCHAR(200) DEFAULT NULL"))
        # Eski o'rnatishlarda ustun INTEGER bo'lib yaratilgan bo'lishi mumkin
        conn.execute(text(
            "ALTER TABLE patient_services "
            "ALTER COLUMN course_days TYPE VARCHAR(200) "
            "USING course_days::VARCHAR(200)"))
        conn.commit()

        tur = conn.execute(text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name='patient_services' AND column_name='course_days'"
        )).scalar()
        print("OK: course_days turi =", tur)
    except Exception as e:
        print("Xato:", e)
