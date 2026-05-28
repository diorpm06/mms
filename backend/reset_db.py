"""DB ni yangilash (yangi ustunlar): python reset_db.py"""
import os
from pathlib import Path

from database import Base, engine

db_file = Path("marjona_med.db")
if db_file.exists():
    os.remove(db_file)
    print("Eski DB o'chirildi")

Base.metadata.create_all(bind=engine)
print("Yangi jadvallar yaratildi. Keyin: python create_ceo.py && python create_admin.py && python seed_demo.py")
