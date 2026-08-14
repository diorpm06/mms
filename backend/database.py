import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from config import settings

logger = logging.getLogger(__name__)

_connect_args = {}
db_url = (os.environ.get("DATABASE_URL") or settings.DATABASE_URL).strip()
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

try:
    if db_url.startswith("sqlite"):
        _connect_args["check_same_thread"] = False
        engine = create_engine(db_url, connect_args=_connect_args)
    else:
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_recycle=300,
            connect_args={"connect_timeout": 5}
        )
except Exception as e:
    logger.error(f"Database engine init error: {e}. Falling back to SQLite memory.")
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def run_migrations():
    """Ensure missing columns in database are added automatically."""
    try:
        with engine.connect() as conn:
            if settings.DATABASE_URL.startswith("sqlite"):
                # Inventory items
                try:
                    result = conn.execute(text("PRAGMA table_info(inventory_items)")).fetchall()
                    existing_cols = [r[1] for r in result]
                    if "cost_price" not in existing_cols:
                        conn.execute(text("ALTER TABLE inventory_items ADD COLUMN cost_price INTEGER DEFAULT 0"))
                        conn.commit()
                except Exception as e:
                    logger.warning(f"inventory_items migration warning: {e}")

                # Patients
                try:
                    result = conn.execute(text("PRAGMA table_info(patients)")).fetchall()
                    existing_cols = [r[1] for r in result]
                    for col in ["cash_amount", "card_amount"]:
                        if col not in existing_cols:
                            conn.execute(text(f"ALTER TABLE patients ADD COLUMN {col} FLOAT DEFAULT 0"))
                    conn.commit()
                except Exception as e:
                    logger.warning(f"patients migration warning: {e}")

                # Services
                try:
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
                    conn.commit()
                except Exception as e:
                    logger.warning(f"services migration warning: {e}")

                # Queue tickets
                try:
                    result = conn.execute(text("PRAGMA table_info(queue_tickets)")).fetchall()
                    existing_cols = [r[1] for r in result]
                    if "category" not in existing_cols:
                        conn.execute(text("ALTER TABLE queue_tickets ADD COLUMN category VARCHAR DEFAULT 'Umumiy'"))
                    if "queue_prefix" not in existing_cols:
                        conn.execute(text("ALTER TABLE queue_tickets ADD COLUMN queue_prefix VARCHAR DEFAULT 'A'"))
                    conn.commit()
                except Exception as e:
                    logger.warning(f"queue_tickets migration warning: {e}")

    except Exception as e:
        logger.warning(f"Migration warning: {e}")

    # services.template_key — SQLite va PostgreSQL ikkalasida ham (mavjud bo'lsa xato
    # jim yutiladi, ADD COLUMN IF NOT EXISTS SQLite'da yo'q)
    try:
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE services ADD COLUMN template_key VARCHAR(50)"))
                conn.commit()
            except Exception:
                conn.rollback()
    except Exception as e:
        logger.warning(f"template_key migration warning: {e}")

    # Ko'p so'raladigan ustunlarga indeks — SQLite va PostgreSQL'da bir xil sintaksis
    try:
        with engine.connect() as conn:
            for stmt in (
                "CREATE INDEX IF NOT EXISTS ix_patients_created_at ON patients (created_at)",
                "CREATE INDEX IF NOT EXISTS ix_patients_provider_id ON patients (provider_id)",
                "CREATE INDEX IF NOT EXISTS ix_patients_service_id ON patients (service_id)",
                "CREATE INDEX IF NOT EXISTS ix_patients_referrer_id ON patients (referrer_id)",
                "CREATE INDEX IF NOT EXISTS ix_transactions_created_at ON transactions (created_at)",
                "CREATE INDEX IF NOT EXISTS ix_transactions_patient_id ON transactions (patient_id)",
                "CREATE INDEX IF NOT EXISTS ix_transactions_provider_id ON transactions (provider_id)",
                "CREATE INDEX IF NOT EXISTS ix_transactions_referrer_id ON transactions (referrer_id)",
            ):
                try:
                    conn.execute(text(stmt))
                except Exception as e:
                    logger.warning(f"Index migration warning ({stmt}): {e}")
            conn.commit()
    except Exception as e:
        logger.warning(f"Index migration warning: {e}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"DB Session error: {e}")
        db.rollback()
        raise e
    finally:
        db.close()
