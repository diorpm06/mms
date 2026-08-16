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

                # Referrers
                try:
                    result = conn.execute(text("PRAGMA table_info(referrers)")).fetchall()
                    existing_cols = [r[1] for r in result]
                    if "lab_percent" not in existing_cols:
                        conn.execute(text("ALTER TABLE referrers ADD COLUMN lab_percent INTEGER DEFAULT 22"))
                    if "fizio_percent" not in existing_cols:
                        conn.execute(text("ALTER TABLE referrers ADD COLUMN fizio_percent INTEGER DEFAULT 20"))
                    if "uzi_sum" not in existing_cols:
                        conn.execute(text("ALTER TABLE referrers ADD COLUMN uzi_sum INTEGER DEFAULT 15000"))
                    if "other_sum" not in existing_cols:
                        conn.execute(text("ALTER TABLE referrers ADD COLUMN other_sum INTEGER DEFAULT 10000"))
                    conn.commit()
                except Exception as e:
                    logger.warning(f"referrers migration warning: {e}")

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

    # Komissiya qoidalari endi bazada (ilgari kodda yozilgan edi).
    for stmt in (
        "ALTER TABLE service_categories ADD COLUMN commission_mode VARCHAR(10) DEFAULT 'none'",
        "ALTER TABLE service_categories ADD COLUMN commission_value INTEGER DEFAULT 0",
        "ALTER TABLE services ADD COLUMN no_referrer_commission BOOLEAN DEFAULT FALSE",
    ):
        try:
            with engine.connect() as conn:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception:
                    conn.rollback()
        except Exception as e:
            logger.warning(f"commission columns migration warning: {e}")

    seed_commission_rules()

    # referrers.ozon_sum — Ozonaterapiya alohida bo'lim, o'z tarifi bilan
    try:
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE referrers ADD COLUMN ozon_sum INTEGER DEFAULT 10000"))
                conn.commit()
            except Exception:
                conn.rollback()
    except Exception as e:
        logger.warning(f"ozon_sum migration warning: {e}")

    # patients/transactions: click_amount, qr_amount — aralash to'lovda Click va QR
    # qismlarini kartadan ajratib yozish uchun
    for stmt in (
        "ALTER TABLE patients ADD COLUMN click_amount INTEGER DEFAULT 0",
        "ALTER TABLE patients ADD COLUMN qr_amount INTEGER DEFAULT 0",
        "ALTER TABLE transactions ADD COLUMN click_amount INTEGER DEFAULT 0",
        "ALTER TABLE transactions ADD COLUMN qr_amount INTEGER DEFAULT 0",
    ):
        try:
            with engine.connect() as conn:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception:
                    conn.rollback()
        except Exception as e:
            logger.warning(f"click/qr amount migration warning: {e}")

    # patients.is_paper_entry — qog'oz jurnalidan (navbatchilikda) kiritilgan
    # bemorlarni hisobotlarda alohida ko'rsatish uchun
    try:
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE patients ADD COLUMN is_paper_entry BOOLEAN DEFAULT FALSE"))
                conn.commit()
            except Exception:
                conn.rollback()
    except Exception as e:
        logger.warning(f"is_paper_entry migration warning: {e}")

    # referrers: lab_percent, fizio_percent, uzi_sum, other_sum, is_confirmed
    for stmt in (
        "ALTER TABLE referrers ADD COLUMN lab_percent INTEGER DEFAULT 22",
        "ALTER TABLE referrers ADD COLUMN fizio_percent INTEGER DEFAULT 20",
        "ALTER TABLE referrers ADD COLUMN uzi_sum INTEGER DEFAULT 15000",
        "ALTER TABLE referrers ADD COLUMN other_sum INTEGER DEFAULT 10000",
        "ALTER TABLE referrers ADD COLUMN is_confirmed BOOLEAN DEFAULT TRUE",
    ):
        try:
            with engine.connect() as conn:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception:
                    conn.rollback()
        except Exception as e:
            logger.warning(f"referrers migration warning: {e}")
            logger.warning(f"users auth-security migration warning: {e}")

    # banners.image_data / content_type — rasm baza ichida saqlanadi
    for stmt in (
        "ALTER TABLE banners ADD COLUMN image_data BYTEA",
        "ALTER TABLE banners ADD COLUMN content_type VARCHAR(100)",
    ):
        try:
            with engine.connect() as conn:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception:
                    conn.rollback()
        except Exception as e:
            logger.warning(f"banners image migration warning: {e}")

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


# Ilgari kodda qat'iy yozilgan komissiya qoidalari. Bular FAQAT bir marta,
# jadval bo'sh bo'lganda ko'chiriladi — keyin rahbar panelidan boshqariladi.
_ESKI_QOIDALAR = {
    "laboratoriya": ("percent", 22),
    "fizioterapiya": ("percent", 20),
    "uzi": ("sum", 15000),
    "ozonaterapiya": ("sum", 10000),
}


def seed_commission_rules():
    """Mavjud xizmat bo'limlarini va eski komissiya qoidalarini bazaga ko'chiradi."""
    from sqlalchemy.orm import Session as _S

    try:
        from models.service import Service
        from models.service_category import ServiceCategory
        from models.referrer import Referrer
        from models.referrer_commission import ReferrerCommission
    except Exception as e:
        logger.warning(f"commission seed import warning: {e}")
        return

    db = _S(bind=engine)
    try:
        # 1) Har bir mavjud bo'lim uchun qator
        bor = {c.name for c in db.query(ServiceCategory).all()}
        kats = set()
        for sv in db.query(Service).all():
            raw = (sv.category or "Umumiy").strip()
            kats.add(raw.split(":")[0].strip() if ":" in raw else raw)

        qoshildi = 0
        for nom in kats:
            if nom in bor:
                continue
            rejim, qiymat = _ESKI_QOIDALAR.get(nom.strip().lower(), ("none", 0))
            db.add(ServiceCategory(name=nom, commission_mode=rejim, commission_value=qiymat))
            qoshildi += 1

        # 2) Yo'naltiruvchilarning eski ustunlaridagi istisnolar
        if db.query(ReferrerCommission).count() == 0:
            maydon = {
                "Laboratoriya": ("lab_percent", "percent", 22),
                "Fizioterapiya": ("fizio_percent", "percent", 20),
                "Uzi": ("uzi_sum", "sum", 15000),
                "Ozonaterapiya": ("ozon_sum", "sum", 10000),
            }
            for r in db.query(Referrer).all():
                for kat, (ustun, rejim, standart) in maydon.items():
                    qiymat = getattr(r, ustun, None)
                    if qiymat is not None and qiymat != standart:
                        db.add(ReferrerCommission(
                            referrer_id=r.id, category=kat, mode=rejim, value=int(qiymat)
                        ))
                        qoshildi += 1

        # 3) "Uzi (qo'shimcha)" — komissiyadan chiqarilgan xizmat
        for sv in db.query(Service).all():
            nom = (sv.name or "").lower()
            if ("qo'shimcha" in nom or "qoshimcha" in nom) and not sv.no_referrer_commission:
                sv.no_referrer_commission = True
                qoshildi += 1

        if qoshildi:
            db.commit()
            logger.info(f"Komissiya qoidalari ko'chirildi: {qoshildi} ta yozuv")
    except Exception as e:
        db.rollback()
        logger.warning(f"commission seed warning: {e}")
    finally:
        db.close()
