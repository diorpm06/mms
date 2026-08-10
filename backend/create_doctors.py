import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from database import SessionLocal, engine, Base
from models.user import User
from models.provider import Provider
from auth_utils import hash_password

def create_doctors():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Ensure providers exist
    p1 = db.query(Provider).filter(Provider.full_name.like("%Karimov%")).first()
    if not p1:
        p1 = Provider(full_name="Dr. Karimov Alisher", specialization="Terapevt", phone="+998901111111", percentage=30)
        db.add(p1)

    p2 = db.query(Provider).filter(Provider.full_name.like("%Rahimova%")).first()
    if not p2:
        p2 = Provider(full_name="Dr. Rahimova Malika", specialization="UZI mutaxassisi", phone="+998902222222", percentage=35)
        db.add(p2)

    db.commit()
    db.refresh(p1)
    db.refresh(p2)

    # Doctor 1
    doc1 = db.query(User).filter(User.username == "doctor1").first()
    if not doc1:
        doc1 = User(
            full_name=p1.full_name,
            role="doctor",
            username="doctor1",
            hashed_password=hash_password("doctor123"),
            provider_id=p1.id,
            is_active=True,
        )
        db.add(doc1)

    # Doctor 2
    doc2 = db.query(User).filter(User.username == "doctor2").first()
    if not doc2:
        doc2 = User(
            full_name=p2.full_name,
            role="doctor",
            username="doctor2",
            hashed_password=hash_password("doctor123"),
            provider_id=p2.id,
            is_active=True,
        )
        db.add(doc2)

    db.commit()
    print("Shifokor akkauntlari yaratildi:")
    print("1) Login: doctor1  | Parol: doctor123 | Dr. Karimov Alisher (Terapevt)")
    print("2) Login: doctor2  | Parol: doctor123 | Dr. Rahimova Malika (UZI mutaxassisi)")

if __name__ == "__main__":
    create_doctors()
