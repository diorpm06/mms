"""SQLite ustunlarni qo'shish (server ishlayotganda): python migrate_db.py"""
import sqlite3
from pathlib import Path

DB = Path("backend/marjona_med.db") if Path("backend/marjona_med.db").exists() else Path("marjona_med.db")
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
add_col("patients", "ticket_number TEXT")
add_col("patients", "queue_status TEXT DEFAULT 'kutmoqda'")
add_col("patients", "cabinet TEXT")
add_col("patients", "discount_amount INTEGER DEFAULT 0")
add_col("patients", "discount_reason TEXT")
add_col("patients", "diagnosis TEXT")
add_col("patients", "complaints TEXT")
add_col("patients", "prescription TEXT")
add_col("expenses", "updated_at DATETIME")
add_col("expenses", "category TEXT")
add_col("users", "provider_id INTEGER")


# Create chat_messages and appointments tables if not exist
cur.execute("""
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(recipient_id) REFERENCES users(id)
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TEXT NOT NULL,
    provider_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    status TEXT DEFAULT 'kutilmoqda',
    notes TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY(provider_id) REFERENCES providers(id),
    FOREIGN KEY(service_id) REFERENCES services(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Sarflash materiali',
    quantity INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'dona',
    min_quantity INTEGER DEFAULT 10,
    unit_price INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS lab_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    test_name TEXT NOT NULL,
    category TEXT DEFAULT 'Qon tahlili',
    results_json TEXT NOT NULL,
    doctor_name TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS shift_incassations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cashier_id INTEGER NOT NULL,
    expected_cash INTEGER DEFAULT 0,
    actual_cash INTEGER DEFAULT 0,
    incassation_amount INTEGER DEFAULT 0,
    variance INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(cashier_id) REFERENCES users(id)
)
""")

conn.commit()
conn.close()

print("Migratsiya va yangi jadvallar yaratilishi tugadi. Serverni qayta ishga tushiring.")
