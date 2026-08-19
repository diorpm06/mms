# 📑 CLAUDE FORUM / TESTER GUIDE: Davolanish Kurslari va Bir Martalik Miqdor (Quantity vs IsCourse) Tizimi

Ushbu hujjat **Claude** va boshqa dasturchilar/testchilar uchun tizimda amalga oshirilgan barcha o'zgarishlar, baza strukturasi, backend API va frontend mantiqlarini to'liq tushuntirib beradi.

---

## 🎯 1. Asosiy Biznes Mantiq (Core Business Requirements)

Ilgari bemor bir marta kelib bugunning o'zida **5 ta Hijoma** yoki **5 ta Ukol** olsa (`quantity = 5`), tizim buni xato ravishda "5 kunlik davolanish kursi" deb o'ylab, bemorni "Davolanishdagilar" ro'yxatiga o'tkazib yuborardi.

### Yechim:
- **`is_course` (Boolean):** Xizmat **faqat va faqat** retseptor xodimi `is_course = True` (`🔁 Ko'p kunlik kurs`) tugmasini bosgandagina ko'p kunlik davolanish kursi deb hisoblanadi.
- **Bir martalik miqdor (Single-visit quantity):** Agar `is_course = False` bo'lsa, xizmat soni 5, 10 yoki 20 ta bo'lsa ham, u **bugungi 1 martalik tashrif** bo'lib saqlanadi va "Davolanishdagilar" ro'yxatiga **TUSHMAYDI**.

---

## 🗄️ 2. Baza Strukturasi va Migratsiyalar (Database Schema)

### `patient_services` jadvali:
```sql
ALTER TABLE patient_services ADD COLUMN IF NOT EXISTS is_course BOOLEAN DEFAULT FALSE;
ALTER TABLE patient_services ADD COLUMN IF NOT EXISTS per_day_qty INTEGER DEFAULT 1;

-- Eski NULL yozuvlarni tozalash:
UPDATE patient_services SET is_course = FALSE WHERE is_course IS NULL;
```

- **`models/patient_service.py`**: `is_course: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")`
- **`database.py`**: SQLite va PostgreSQL uchun avtomatik migratsiya kodi kiritilgan.

---

## ⚙️ 3. Backend Implementation (FastAPI & SQLAlchemy)

### A. Schemas (`backend/schemas.py` & `patients.py`):
- `ServiceItem` pydantic modeliga `is_course: Optional[bool] = False` qo'shilgan.
- `create_patient` va `update_patient` funksiyalarida `PatientService` obyektiga `is_course` qiymati saqlanadi.

### B. Course Aggregator (`backend/routers/courses.py` -> `_kurslarni_yig`):
- **Saralash filtri:** `is_c = getattr(ps, "is_course", False)`. Faqat `is_c is True` bo'lgan yozuvlargagina `_oldindan = True` belgilanadi.
- **Bajarilgan kunlar hisobi:** `effective_used = max(tashriflar.get(ps.id, 0), int(ps.used_count or 0))` — ham real tashriflarni, ham administrator tomonidan qo'lda tahrirlangan kunlarni hisobga oladi.
- **Bekor qilinganlarni filtrlash:** `Patient.is_cancelled == False` — bekor qilingan to'lovlar va bekor qilingan kunlik tashriflar avtomatik ro'yxatdan chiqariladi.

### C. Yangi Edit API Endpoint:
- **`PUT /api/courses/edit`**
  - **Payload:**
    ```json
    {
      "key": "tel:+998901234567::2026-08-19",
      "items": [
        {
          "service_id": 155,
          "quantity": 7,
          "used_count": 3
        }
      ]
    }
    ```
  - `quantity` (jami kunlar) va `used_count` (o'tilgan kunlar) ni yangilaydi, auditorlik logini yozadi (`COURSE_EDIT`).

---

## 🎨 4. Frontend Implementation (React & TailwindCSS)

### A. Registratsiya va Qayta yozish oynalari:
- **[NewPatient.jsx](file:///c:/Users/hp/OneDrive/Desktop/mms%20crm/marjona-med/frontend/src/pages/admin/NewPatient.jsx)** & **[ReRegisterPatientModal.jsx](file:///c:/Users/hp/OneDrive/Desktop/mms%20crm/marjona-med/frontend/src/components/ReRegisterPatientModal.jsx)**:
  - Tugma ko'rinishi:
    - Inactive (Oddiy tashrif): `[ ➕ Davolanish kursi qilish ]` (yoki `[ Bugungi tashrifda 5 dona ]`)
    - Active (Kurs): `[ 🔁 Ko'p kunlik kurs (5 kun) ✓ ]` (binafsha rangli nishon)
  - `updateServiceIsCourse` funksiyasi `is_course` yoqilganda va soni 1 bo'lganda avtomatik `quantity = 2` qiladi.
  - Layout bug'i tuzatilgan: 2 qatlamli moslashuvchan responsive flex qilingan, summasi va `🗑️` tugmasi karta ramkasidan tashqariga chiqmaydi.

### B. Davolanishdagilar Sahifasi:
- **[Courses.jsx](file:///c:/Users/hp/OneDrive/Desktop/mms%20crm/marjona-med/frontend/src/pages/admin/Courses.jsx)**:
  - Har bir bemor kartasida **`✏️ (Pencil)`** tugmasi mavjud.
  - **`EditCourseModal`**: Kunlar sonini oshirish/kamaytirish, bajarilgan kunlarni sozlash hamda bosiladigan interaktiv `1-kun ✓`, `2-kun ✓`, `3-kun ⏳` nishonlari kiritilgan.

---

## 🧪 5. Avtomatlashtirilgan Verification Testlari (How to Test)

Backend `backend/` papkasida quyidagi test skriptlarini ishga tushirish orqali tizimni sinashingiz mumkin:

```powershell
# 1. Single-Visit Quantity (5 dona bugungi tashrif Davolanishdagilarga o'tmasligini sinash):
.\.venv\Scripts\python.exe test_single_visit_multi_qty.py

# 2. Daily Ticket & Kassa Revenue (Pul dubl bo'lmasligi va Talon generatorini sinash):
.\.venv\Scripts\python.exe test_finance_and_daily_ticket.py

# 3. Edit Course Endpoint (Kunlarni tahrirlash endpointini sinash):
.\.venv\Scripts\python.exe test_edit_course_endpoint.py

# 4. All Edge Cases (Bekor qilish, Undo, Tugallanish va Qayta faollashuvni sinash):
.\.venv\Scripts\python.exe test_edge_cases_verification.py
```

### Kutilayotgan Natija (Expected Result):
Barcha testlar `✅ VERIFICATION SUCCESSFUL` xabari bilan 100% muvaffaqiyatli yakunlanishi kerak.

---

## 📝 6. QA Checklist for Claude / Testers

1. [x] **Single-visit quantity 5:** Bemor 5 ta Hijoma olib `is_course = False` bo'lsa -> "Davolanishdagilar" ro'yxatida ko'rinmaydi.
2. [x] **Multi-day course 5:** `[ ➕ Davolanish kursi qilish ]` bosilib saqlansa -> "Davolanishdagilar" ro'yxatida `5 kunlik kurs` bo'lib ko'rinadi.
3. [x] **Keldi Visit:** "Keldi" bosilganda bemorga navbat taloni chop etiladi, kunlik daromadga 0 so'm qo'shiladi (dubl emas).
4. [x] **Undo Visit:** "Keldi" adashib bosilganda `↩️ Undo` bosilsa -> kun qayta tiklanadi (+1 kun).
5. [x] **Edit Modal:** `✏️ Tahrirlash` modalida kunlar 5 kundan 7 kunga oshirilsa -> qolgan kunlar avtomatik 2 kunga oshadi.
6. [x] **UI Layout:** Barcha o'chamli ekranlarda tanlangan xizmatlar kartasining summasi va `🗑️` tugmasi ramka ichida tekis turadi.
