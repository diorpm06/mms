import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import engine
from sqlalchemy import text

print("=== SANITIZING LEGACY NULL is_course ROWS IN DB ===")

with engine.connect() as conn:
    try:
        res = conn.execute(text("UPDATE patient_services SET is_course = FALSE WHERE is_course IS NULL;"))
        conn.commit()
        print(f"✅ SUCCESS: Updated legacy NULL is_course rows to FALSE!")
    except Exception as e:
        print(f"❌ Error updating rows: {e}")
