# Marjona Med Service

Tibbiy klinika boshqaruv platformasi — React + FastAPI + PostgreSQL.

![Logo](assets/logo.png)

## Texnologiyalar

- **Frontend:** React, Tailwind CSS, Zustand, Recharts
- **Backend:** FastAPI, SQLAlchemy, JWT
- **DB:** PostgreSQL
- **Bot:** aiogram 3.x
- **Integratsiya:** Google Sheets (gspread), Telegram, APScheduler
- **Export:** Excel (openpyxl), PDF (reportlab)
- **Offline:** IndexedDB + Service Worker

## O'rnatish

### 1. PostgreSQL

```sql
CREATE DATABASE marjona_med;
```

### 2. Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
pip install -r requirements.txt
```

`.env` faylini loyiha ildizidan `backend/` ga nusxalang yoki yarating (`.env.example` dan):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/marjona_med
SECRET_KEY=your_secret_key
BOT_TOKEN=...
CEO_CHAT_ID=...
SPREADSHEET_ID=...
FRONTEND_URL=http://localhost:5173
```

```bash
python create_ceo.py ceo ceo123 "CEO Admin"
python create_admin.py admin admin123 "Admin User"
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Brauzer: http://localhost:5173

### 4. Telegram bot

```bash
cd backend
python bot/bot.py
```

### 5. Google Sheets

1. Google Cloud da Service Account yarating
2. `credentials.json` ni `backend/` ga qo'ying
3. Spreadsheet ni service account email bilan ulashing
4. `google-apps-script/Code.gs` ni Spreadsheet → Extensions → Apps Script ga joylashtiring

## Rollar

| Rol   | Login default | Imkoniyatlar        |
|-------|---------------|---------------------|
| CEO   | ceo / ceo123  | Barcha boshqaruv    |
| Admin | admin / admin123 | Mijoz, harajat   |

## API

Swagger: http://localhost:8000/docs

## Loyiha strukturasi

```
marjona-med/
├── assets/logo.png
├── backend/
├── frontend/
├── google-apps-script/
└── .env.example
```

## Muhim eslatmalar

- Barcha summalar **butun son** (so'm)
- Telefon: `+998XXXXXXXXX`
- O'chirish = soft delete (`is_active = false`)
- 10 kunlik foiz: 10, 20, oy oxiri 00:00
- Oylik maosh: oy oxirgi kuni 00:00

---

**Marjona Med Service** © 2026
