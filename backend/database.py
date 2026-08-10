from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from config import settings

_connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    _connect_args["check_same_thread"] = False

engine = create_engine(settings.DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def run_migrations():
    """Ensure missing columns in SQLite database are added automatically."""
    try:
        with engine.connect() as conn:
            if settings.DATABASE_URL.startswith("sqlite"):
                # Check patients columns
                result = conn.execute(text("PRAGMA table_info(patients)")).fetchall()
                existing_cols = [r[1] for r in result]
                for col in ["cash_amount", "card_amount"]:
                    if col not in existing_cols:
                        conn.execute(text(f"ALTER TABLE patients ADD COLUMN {col} FLOAT DEFAULT 0"))

                # Check transactions columns
                result = conn.execute(text("PRAGMA table_info(transactions)")).fetchall()
                existing_cols = [r[1] for r in result]
                for col in ["cash_amount", "card_amount"]:
                    if col not in existing_cols:
                        conn.execute(text(f"ALTER TABLE transactions ADD COLUMN {col} FLOAT DEFAULT 0"))
                # Check services cabinet and category columns
                result = conn.execute(text("PRAGMA table_info(services)")).fetchall()
                existing_cols = [r[1] for r in result]
                if "cabinet" not in existing_cols:
                    conn.execute(text("ALTER TABLE services ADD COLUMN cabinet VARCHAR DEFAULT '1-Xona'"))
                if "category" not in existing_cols:
                    conn.execute(text("ALTER TABLE services ADD COLUMN category VARCHAR DEFAULT 'Umumiy'"))
                if "requires_queue" not in existing_cols:
                    conn.execute(text("ALTER TABLE services ADD COLUMN requires_queue BOOLEAN DEFAULT 1"))
                if "queue_prefix" not in existing_cols:
                    conn.execute(text("ALTER TABLE services ADD COLUMN queue_prefix VARCHAR DEFAULT 'A'"))
                if "referrer_commission_percent" not in existing_cols:
                    conn.execute(text("ALTER TABLE services ADD COLUMN referrer_commission_percent INTEGER DEFAULT 0"))
                if "referrer_commission_sum" not in existing_cols:
                    conn.execute(text("ALTER TABLE services ADD COLUMN referrer_commission_sum INTEGER DEFAULT 0"))
                if "referrer_doctor_split_percent" not in existing_cols:
                    conn.execute(text("ALTER TABLE services ADD COLUMN referrer_doctor_split_percent INTEGER DEFAULT 50"))
                if "referrer_clinic_split_percent" not in existing_cols:
                    conn.execute(text("ALTER TABLE services ADD COLUMN referrer_clinic_split_percent INTEGER DEFAULT 50"))
                if "referrer_doctor_split_sum" not in existing_cols:
                    conn.execute(text("ALTER TABLE services ADD COLUMN referrer_doctor_split_sum INTEGER DEFAULT 0"))
                if "referrer_clinic_split_sum" not in existing_cols:
                    conn.execute(text("ALTER TABLE services ADD COLUMN referrer_clinic_split_sum INTEGER DEFAULT 0"))
                if "allow_custom_price" not in existing_cols:
                    conn.execute(text("ALTER TABLE services ADD COLUMN allow_custom_price BOOLEAN DEFAULT 0"))

                # Check providers fixed_salary column
                result = conn.execute(text("PRAGMA table_info(providers)")).fetchall()
                existing_cols = [r[1] for r in result]
                if "fixed_salary" not in existing_cols:
                    conn.execute(text("ALTER TABLE providers ADD COLUMN fixed_salary INTEGER DEFAULT 0"))

                # Check saved_reports table
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS saved_reports (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        report_type VARCHAR(20) NOT NULL,
                        period_start VARCHAR(10) NOT NULL,
                        period_end VARCHAR(10) NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        pdf_data BLOB,
                        json_data TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """))

                # Check provider_advances table
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS provider_advances (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        recipient_type VARCHAR(20) NOT NULL,
                        recipient_id INTEGER NOT NULL,
                        amount INTEGER NOT NULL,
                        remaining INTEGER NOT NULL,
                        note TEXT,
                        period_start DATE,
                        is_settled BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        settled_at DATETIME
                    )
                """))

                # Check provider_services table
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS provider_services (
                        provider_id INTEGER NOT NULL REFERENCES providers(id),
                        service_id INTEGER NOT NULL REFERENCES services(id),
                        PRIMARY KEY (provider_id, service_id)
                    )
                """))
                conn.commit()
    except Exception as e:
        print(f"Auto-migration warning: {e}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
