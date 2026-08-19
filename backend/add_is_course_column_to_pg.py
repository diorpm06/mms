import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import engine
from sqlalchemy import text

print("=== ADDING is_course COLUMN TO patient_services TABLE IN POSTGRESQL ===")

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE patient_services ADD COLUMN IF NOT EXISTS is_course BOOLEAN DEFAULT FALSE"))
        conn.commit()
        print("✅ SUCCESS: patient_services.is_course column added to PostgreSQL database!")
    except Exception as e:
        print(f"❌ Error adding column: {e}")
