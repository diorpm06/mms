"""SQLite ustunlarni qo'shish (server ishlayotganda): python migrate_db.py"""
import sqlite3
from pathlib import Path

DB = Path("marjona_med.db")
if not DB.exists():
    print("DB topilmadi — avval serverni ishga tushiring yoki reset_db.py")
    exit(1)

conn = sqlite3.connect(DB)
cur = conn.cursor()

def col_exists(table, col):
    cur.execute(f"PRAGMA table_info({table})")
    return any(r[1] == col for r in cur.fetchall())

def add_col(table, col_def):
    if not col_exists(table, col_def.split()[0]):
        try:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col_def}")
            print(f"  + {table}.{col_def.split()[0]}")
        except Exception as e:
            print(f"  skip {table}: {e}")

for table in ("patients", "transactions", "expenses", "advances", "inpatients", "inpatient_payments"):
    add_col(table, "is_cancelled BOOLEAN DEFAULT 0")
    add_col(table, "cancelled_at DATETIME")
    add_col(table, "cancelled_by INTEGER")
    add_col(table, "cancel_reason TEXT")

add_col("patients", "updated_at DATETIME")
add_col("expenses", "updated_at DATETIME")
add_col("expenses", "category TEXT")

# Yangi jadvallar SQLAlchemy create_all orqali
conn.commit()
conn.close()
print("Migratsiya tugadi. Serverni qayta ishga tushiring.")
