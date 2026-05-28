"""Birinchi CEO foydalanuvchini yaratish: python create_ceo.py"""
import sys

from database import SessionLocal, Base, engine
from models.user import User
from auth_utils import hash_password

Base.metadata.create_all(bind=engine)

def main():
    username = sys.argv[1] if len(sys.argv) > 1 else "ceo"
    password = sys.argv[2] if len(sys.argv) > 2 else "ceo123"
    full_name = sys.argv[3] if len(sys.argv) > 3 else "CEO Admin"

    db = SessionLocal()
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        print(f"Foydalanuvchi '{username}' allaqachon mavjud")
        return

    user = User(
        full_name=full_name,
        role="ceo",
        username=username,
        hashed_password=hash_password(password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    print(f"CEO yaratildi: {username} / {password}")

if __name__ == "__main__":
    main()
