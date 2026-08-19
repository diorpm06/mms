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
ALTER TABLE patient_services ADD COLUMN used_count INTEGER DEFAULT 0;

-- Eski NULL yozuvlarni tozalash:
UPDATE patient_services SET is_course = FALSE WHERE is_course IS NULL;
UPDATE patient_services SET used_count = 0 WHERE used_count IS NULL;
```

- **`models/patient_service.py`**: `is_course: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")`
- **`database.py`**: SQLite va PostgreSQL uchun avtomatik migratsiya kodi kiritilgan.

> ⚠️ **`per_day_qty` mavjud emas.** Hujjatning oldingi tahririda bu ustun
> ko'rsatilgan edi, lekin u na modelda, na migratsiyada, na kodda bor.
> Rejalashtirilgan, ammo qo'shilmagan.

### `used_count` — 0 dan boshlanadi

`used_count` — nechta seans **ishlatilgani**. Yangi yozuvda **0** bo'lishi shart:
ro'yxatga olishning o'zi kunni yemaydi, birinchi kun uchun ham "Keldi" bosiladi
va o'sha payt navbat taloni chop etiladi.

> 🐛 **2026-08-19 da topilgan xato:** modelda `default=1` turgan edi. Ya'ni
> ro'yxatga olish bitta kunni "ishlatilgan" deb yozardi, keyin "Keldi"
> bosilganda yana +1 bo'lardi. Natijada **har bir kurs bir kunni yo'qotardi**:
> 4 kunga to'lagan, bir marta kelgan bemorda "ishlatilgan 3, qoldi 1" chiqardi.
> Model, migratsiya va API tuzatildi; jonli bazadagi 173 ta yozuv haqiqiy
> tashriflar soniga tenglashtirildi.

### ⚠️ Ustun keyin qo'shilganda eski qatorlar

`is_course` ustuni `DEFAULT FALSE` bilan qo'shilgani uchun **ilgari mavjud
bo'lgan haqiqiy kurslar ham `false` bo'lib qoldi** va "Davolanishdagilar"
ro'yxatidan butunlay yo'qoldi (Imronbek va Sakinaning 220 000 lik kurslari).
Bunday ustun qo'shilganda eski ma'lumotni **qo'lda to'g'rilash shart**:

```sql
-- ustun qo'shilishidan oldin yaratilgan, soni>1 bo'lgan haqiqiy kurslar
UPDATE patient_services SET is_course = true
WHERE quantity > 1 AND is_course = false AND <ustun qo'shilgan sanadan oldin>;
```

---

## ⚙️ 3. Backend Implementation (FastAPI & SQLAlchemy)

### A. Schemas (`backend/schemas.py` & `patients.py`):
- `ServiceItem` pydantic modeliga `is_course: Optional[bool] = False` qo'shilgan.
- `create_patient` va `update_patient` funksiyalarida `PatientService` obyektiga `is_course` qiymati saqlanadi.

### B. Course Aggregator (`backend/routers/courses.py` -> `_kurslarni_yig`):
- **Saralash filtri:** `is_c = getattr(ps, "is_course", False)`. Faqat `is_c is True` bo'lgan yozuvlargagina `_oldindan = True` belgilanadi.
- **Bajarilgan kunlar hisobi:** `effective_used = max(tashriflar.get(ps.id, 0), int(ps.used_count or 0))` — ham real tashriflarni, ham administrator tomonidan qo'lda tahrirlangan kunlarni hisobga oladi.
  Bu faqat `used_count` **0 dan boshlanganda** to'g'ri ishlaydi (yuqoridagi
  xatoga qarang): aks holda `max()` ro'yxatga olishdagi standart qiymatni
  "ishlatilgan kun" deb qabul qilib, bemorning bir kunini yeb qo'yadi.
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

### 🛑 AVVAL O'QING: bu testlar jonli bazani ifloslantirgan

Quyidagi skriptlar `DATABASE_URL` ni almashtirmasdan `from database import
SessionLocal` qilardi, ya'ni **jonli Supabase bazasiga** ulanib, u yerda
haqiqiy `Patient` yozuvlari yaratardi. Tozalash qismi ham yo'q edi.

Natijada 2026-08-19 kuni jonli bazada **21 ta test bemori** topildi
(`EditCourse TestPatient`, `FinanceTest CoursePatient`, `TestSingleVisit`...).
Ularning 5 tasi klinikaning "Davolanishdagilar" ro'yxatini to'ldirib turgan,
biri "18 kun, qoldi 12" deb ko'rinardi. Baxtga, tranzaksiyasi bo'lmagani
uchun pul hisobiga tegmagan. Hammasi zaxira olinib o'chirildi.

Endi bu skriptlarning boshiga **qalqon** qo'yilgan: `DATABASE_URL` sqlite
bilan boshlanmasa, ular darrov to'xtaydi.

```powershell
# Har doim vaqtinchalik baza bilan ishga tushiring:
$env:DATABASE_URL = 'sqlite:///C:/Temp/sinov.db'

# 1. Single-Visit Quantity (5 dona bugungi tashrif Davolanishdagilarga o'tmasligini sinash):
.\.venv\Scripts\python.exe test_single_visit_multi_qty.py

# 2. Daily Ticket & Kassa Revenue (Pul dubl bo'lmasligi va Talon generatorini sinash):
.\.venv\Scripts\python.exe test_finance_and_daily_ticket.py

# 3. Edit Course Endpoint (Kunlarni tahrirlash endpointini sinash):
.\.venv\Scripts\python.exe test_edit_course_endpoint.py

# 4. All Edge Cases (Bekor qilish, Undo, Tugallanish va Qayta faollashuvni sinash):
.\.venv\Scripts\python.exe test_edge_cases_verification.py
```

### Yangi test yozganda majburiy qoida

1. Importlardan **OLDIN** `DATABASE_URL` ni vaqtinchalik SQLite fayliga
   qarating.
2. Import qilingandan keyin qalqonni tekshiring:
   `assert str(engine.url).startswith("sqlite"), "XAVF: jonli bazaga ulandi!"`
3. Test yaratgan hamma narsani o'zi tozalasin — lekin tozalash **faqat
   o'zi yaratgan yozuvlarga** tegsin. `DELETE FROM <jadval>` (shartsiz)
   yozish mumkin emas: shunday qator tufayli 2026-08-18 da jonli bazada
   840 ta kassa yozuvi va 744 ta audit yozuvi yo'qolgan.

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
7. [x] **1-kun avtomatik belgilanmaydi:** yangi kurs ochilganda `used_count = 0`.
   4 kunlik kursda hech "Keldi" bosilmagan bo'lsa — "qoldi 4" bo'lishi kerak,
   "qoldi 3" emas.
8. [x] **Eski kurslar yo'qolmagan:** `is_course` ustuni qo'shilishidan oldin
   yaratilgan haqiqiy kurslar ham ro'yxatda turibdi.
9. [x] **Jonli bazada test yozuvi yo'q:** ismida `test`, `EditCourse`,
   `FinanceTest` bo'lgan bemor qolmagan.
