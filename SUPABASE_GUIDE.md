# 🔌 SUPABASE DATABASE ACCESS GUIDE FOR CLAUDE & DEVELOPERS

This repository connects to a cloud-hosted **Supabase PostgreSQL Database**.

---

### 🔑 Supabase Connection Credentials & URIs

All backend code (`backend/database.py`, `backend/services/*.py`) reads `DATABASE_URL` from `backend/.env`.

#### 1. Primary Transaction Pooler (Port 5432):
```env
DATABASE_URL=postgresql://postgres.jfulmcvwtyfykrukhmdw:marjonamd006@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

#### 2. Session Pooler (Port 6543 - Recommended for DDL / Schema Migrations / Long queries):
```env
DATABASE_URL=postgresql://postgres.jfulmcvwtyfykrukhmdw:marjonamd006@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

---

### 📌 Supabase Connection Parameters Breakdown:

| Parameter | Value | Description |
| :--- | :--- | :--- |
| **Host** | `aws-0-ap-northeast-1.pooler.supabase.com` | Supabase Pooler Server (Tokyo Region) |
| **Port** | `5432` or `6543` | 5432 (Transaction) / 6543 (Session) |
| **Database** | `postgres` | Default Postgres DB |
| **Username** | `postgres.jfulmcvwtyfykrukhmdw` | Supabase Project Tenant User |
| **Password** | `marjonamd006` | Supabase Database Password |
| **Project Ref** | `jfulmcvwtyfykrukhmdw` | Supabase Project ID |

---

### 💻 Python Code Snippet to Query Supabase directly:

```python
import os
import psycopg2
from dotenv import load_dotenv

# Load backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

db_url = os.getenv("DATABASE_URL")
conn = psycopg2.connect(db_url)
cursor = conn.cursor()

# Read example query
cursor.execute("SELECT id, full_name, balance FROM providers WHERE is_active = True;")
rows = cursor.fetchall()
for row in rows:
    print(row)

conn.close()
```

---

### ⚡ Running Commands via Shell (psycopg2 / SQLAlchemy):

To run any script in this workspace using virtual environment:
```powershell
.venv\Scripts\python.exe <script_path.py>
```
