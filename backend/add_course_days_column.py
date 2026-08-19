import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import engine
from sqlalchemy import text

print("=== ADDING course_days COLUMN TO DB IF NOT EXISTS ===")

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE patient_services ADD COLUMN IF NOT EXISTS course_days INTEGER DEFAULT NULL;"))
        conn.commit()
        print("✅ SUCCESS: Added course_days column to patient_services!")
    except Exception as e:
        print("Error/Already exists:", e)
