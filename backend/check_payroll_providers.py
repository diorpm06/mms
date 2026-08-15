import os
import sys

env_file = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_file):
    with open(env_file, 'r', encoding='utf-8') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k] = v

sys.path.append(os.path.dirname(__file__))

from database import SessionLocal
from models.provider import Provider

db = SessionLocal()

provs = db.query(Provider).all()
print("--- ALL PROVIDERS (SHIFOKORLAR) ---")
for p in provs:
    print(f"ID: {p.id} | Name: {p.full_name} | Spec: {p.specialization} | Percentage: {p.percentage}% | FixedSalary: {getattr(p, 'fixed_salary', 0)}")

db.close()
