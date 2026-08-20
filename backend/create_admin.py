"""Admin foydalanuvchi yaratish: python create_admin.py [username] [password] [full_name]"""
import sys

from database import SessionLocal, Base, engine
from models.user import User
from auth_utils import hash_password

Base.metadata.create_all(bind=engine)


def main():
    username = sys.argv[1] if len(sys.argv) > 1 else "admin"
    password = sys.argv[2] if len(sys.argv) > 2 else "admin123"
    full_name = sys.argv[3] if len(sys.argv) > 3 else "Admin"

    db = SessionLocal()
    if db.query(User).filter(User.username == username).first():
        print(f"'{username}' allaqachon mavjud")
        return
    user = User(
        full_name=full_name,
        role="admin",
        username=username,
        hashed_password=hash_password(password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    print(f"Admin yaratildi: {username} / {password}")


if __name__ == "__main__":
    main()
