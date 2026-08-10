from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from config import settings

_connect_args = {}
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

if db_url.startswith("sqlite"):
    _connect_args["check_same_thread"] = False
    engine = create_engine(db_url, connect_args=_connect_args)
else:
    engine = create_engine(db_url, connect_args=_connect_args, pool_pre_ping=True, pool_recycle=300)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def run_migrations():
    """Ensure missing columns in database are added automatically."""
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

                # Check queue_tickets columns
                result = conn.execute(text("PRAGMA table_info(queue_tickets)")).fetchall()
                existing_cols = [r[1] for r in result]
                if "category" not in existing_cols:
                    conn.execute(text("ALTER TABLE queue_tickets ADD COLUMN category VARCHAR DEFAULT 'Umumiy'"))
                if "queue_prefix" not in existing_cols:
                    conn.execute(text("ALTER TABLE queue_tickets ADD COLUMN queue_prefix VARCHAR DEFAULT 'A'"))

                conn.commit()
    except Exception as e:
        print("Migration info/warn:", e)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
