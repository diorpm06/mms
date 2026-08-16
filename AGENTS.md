# Marjona Med Servis CRM — ish daftari

Bu fayl **Claude Code** va **Antigravity** uchun umumiy eslatma. Ikkalasi ham
shu loyihada ishlaydi, shuning uchun kim nima qilgani va nima qolgani shu yerda
yozib boriladi.

**Ishni boshlashdan oldin shu faylni o'qing. Ish tugagach shu faylni yangilang.**

Oxirgi yangilanish: 2026-08-16

---

## 1. Eng muhim qoidalar

### 1.1. Bir vaqtda ikki vosita ishlamasin
Bugun ikki marta o'zgarishlar ustma-ust yozildi:
- `services/reports_data.py` bir necha daqiqa **buzuq holatda** qoldi
  (`for p in pr_patients:` qatori yo'qolgan edi) — backend umuman ishga tushmadi.
- `pages/ceo/Referrers.jsx` da "Ozonaterapiya" ustuni **eski holiga qaytarildi**.

Shuning uchun: bir faylni bir vaqtda ikkovi tahrirlamasin. Ish boshlashdan oldin
shu faylning 2-bo'limiga "hozir nima ustida ishlayapman" deb yozib qo'ying.

### 1.2. Gitga yuborish — faqat egasi aytganda
Klinika rahbari aniq aytgan: **buyruq bo'lmaguncha `git push` qilinmaydi.**
O'zgarishlar ishchi papkada qoldiriladi.

### 1.3. Baza HAQIQIY
`backend/.env` dagi `DATABASE_URL` — Supabase'dagi **ishlab turgan** baza.
Localda ishlaganda ham har bir yozuv haqiqiy bazaga tushadi va Telegramga
xabar ketadi. Sinov ma'lumoti yaratsangiz — **albatta o'chiring**.

Sinov uchun ism prefiksi: `ZZ...` (masalan `ZZSINOV`). Tozalash:
```sql
DELETE FROM patient_services WHERE patient_id IN (SELECT id FROM patients WHERE first_name LIKE 'ZZ%');
DELETE FROM transactions     WHERE patient_id IN (SELECT id FROM patients WHERE first_name LIKE 'ZZ%');
DELETE FROM patients WHERE first_name LIKE 'ZZ%';
UPDATE providers SET balance=0; UPDATE referrers SET balance=0;
```

### 1.4. Hisobot funksiyalari bazaga yozmasin
`daily_report()` va rahbar paneli **hech narsa yozmaydi**. Ilgari ular
`sync_advances_and_salaries_to_expenses()` ni chaqirardi va u chaqiruvchining
sessiyasini commit qilib yuborardi — hisobotni ochish yarim tugallangan
o'zgarishlarni bazaga yozib qo'yardi.

Bu chaqiruv olib tashlandi. Avans/oylik yozilganda harajat yozuvi darhol
yaratiladi (`advances.py`, `employees.py`), shuning uchun backfill kerak emas.
Funksiya faqat `list_expenses()` da qoldi (eski ma'lumot uchun) va o'zining
alohida sessiyasida ishlaydi.

**Hisobot o'qish yo'liga yozish qo'shmang.**

### 1.5. Bemorni o'zgartirishdan oldin qulflang
`update_patient` va `cancel_patient` da `_bemorni_qulflab_ol(db, patient_id)`
ishlatiladi (`SELECT ... FOR UPDATE`). Ikki qurilmadan bir vaqtda tahrirlash
sinovda xizmat ro'yxatini ikki barobar qilib qo'ygan, ikki marta bekor qilishga
ham yo'l qo'ygan edi. Bemorga tegadigan yangi endpoint yozsangiz shu
yordamchidan foydalaning.

---

## 2. Hozir kim nima ustida ishlayapti

| Vosita | Fayllar | Holat |
|---|---|---|
| _(bo'sh)_ | | |

---

## 3. Muhim qarorlar (o'zgartirishdan oldin egasidan so'rang)

### 3.1. Yo'naltiruvchi komissiyasi
Komissiya **faqat 4 ta bo'limga** beriladi. Qolgan hamma bo'limga — **0**.

| Bo'lim | Turi | Standart |
|---|---|---|
| Laboratoriya | foiz | 22% |
| Fizioterapiya | foiz | 20% |
| Uzi | summa | 15 000 |
| Ozonaterapiya | summa | 10 000 |

- Istisno: `"Uzi (qo'shimcha)"` xizmatiga komissiya berilmaydi
  (`services.no_referrer_commission = true`).
- Bu qiymatlar **kodda emas, bazada**: `service_categories` jadvali.
  Ayrim shaxs uchun boshqacha tarif — `referrer_commissions` jadvali.
- Boshqarish: Rahbar paneli → **Yo'naltiruvchilar** → 3-ichki bo'lim
  "Komissiya Sozlamasi". Ilgari alohida sahifa edi, yon panelda ikkita
  yo'naltiruvchi punkti turgani uchun birlashtirildi. Eski `/ceo/commissions`
  havolasi ham shu sahifaga olib boradi.
- Kodda qat'iy yozib qo'ymang. `get_referrer_rates_for_service()` bazadan o'qiydi
  va keshda saqlaydi; sozlama o'zgarganda `invalidate_commission_cache()` chaqiriladi.

### 3.2. 100% oladigan shifokorlar
`Dr. Umida` (Endokrinologiya Maslaxat) va `Dr. Soxiba` (Nevrologiya Maslaxat)
to'lovni **to'liq o'zlari** oladi. Markazga ham, yo'naltiruvchiga ham hech narsa
ketmaydi. Bu xato emas — klinikaning haqiqiy kelishuvi.

### 3.3. UZI qoidasi
UZI bo'limida: markaz qat'iy 10 000 oladi, qolganining 50% i shifokorga.
Chegirma berilgan bo'lsa markazning qat'iy ulushi 0 ga tushadi.

### 3.4. Ulushlar yig'indisi
`yo'naltiruvchi + shifokor + markaz` **har doim** to'lovga teng bo'lishi shart.
`center_amount` ni `max(0, ...)` bilan qismang — u minusga tusha olishi kerak,
aks holda tizim yo'qdan pul yaratadi.

---

## 4. Bajarilgan ishlar (2026-08-15 / 16)

### Moliyaviy mantiq
- Komissiya qoidalari koddan bazaga ko'chirildi (yuqoriga qarang)
- `top_services` endi har bir xizmatni alohida sanaydi (ilgari tashrifdagi
  birinchi xizmatga butun summa yozilardi)
- Shifokorga balans chiqarilganda **avans qarzi avval qoplanadi**
- Aralash to'lovda Click/QR kartadan alohida yoziladi
  (`patients.click_amount`, `qr_amount`)
- Bemorni o'chirganda balanslar orqaga qaytariladi

### Ma'lumot tekshiruvi (ro'yxatga olish + tahrirlash)
Quyidagilar endi rad etiladi: manfiy summa/narx, 0 yoki manfiy son, 10^12 kabi
katta son, narxdan katta chegirma, bo'sh ism, kelajakdagi tug'ilgan sana,
mavjud bo'lmagan xizmat/shifokor/yo'naltiruvchi, noto'g'ri to'lov turi.
Harajat, xodim, xizmat, yo'naltiruvchi, omborda ham bo'sh nom rad etiladi.

### Ruxsatlar
- Yo'naltiruvchiga pul chiqarish — faqat rahbar
- Xizmatni o'chirish — faqat rahbar
- Shifokorga to'lash — admin ham (harajatlar bo'limida ishlatiladi, ataylab)

### Navbat raqami
Raqam `COUNT(*) + 1` bilan olinardi. Bemor **o'chirilsa sanoq kamayib**, keyingi
bemorga allaqachon berilgan raqam qayta berilardi — TV taxtasida va chekda ikki
bemorda bir xil navbat chiqardi. Sinovda tasdiqlangan: 3 ta bemor (M-001..003),
o'rtadagisi o'chirilgach yangi bemor **M-003** olgan.

Endi `_keyingi_raqam()` mavjud raqamlarning **eng kattasidan** keyingisini beradi.
Yangi kod yozganda `COUNT(*) + 1` ishlatmang.

### Tezlik
- `top_referrers_analytics()` har bir yo'naltiruvchi uchun alohida so'rov
  yuborardi (N+1). Bitta jamlovchi so'rovga aylantirildi: **10.1 s → 1.0 s**.
  Komissiya endi qaytadan hisoblanmaydi — `Transaction.referrer_amount` dan
  olinadi, ya'ni hisobot haqiqatan to'langan pulga mos keladi.

### Ko'rinish
- Jadval qatoridagi amallar **`ActionMenu`** (⋮) komponentiga yig'ildi
  (`components/ActionMenu.jsx`). Ilgari qatorda 4-7 ta tugma yonma-yon turib,
  tor ustunda o'ralib ketardi va qator balandligi 3 barobar oshardi.
  Qoida: eng ko'p ishlatiladigan 1-2 amal ochiq qoladi, qolgani menyuda.
  Sahifa darajasidagi tugmalarni (chop etish, smena, tab) menyuga yashirmang.
- Barcha tugmalar bitta asosdan (`index.css`) — o'lchami va fokusi bir xil
- `.card table thead th` — qo'lda yozilgan jadvallar ham bir xil ko'rinadi
- Oynalar aylantiriladigan bo'ldi, orqa fon qulflanadi
- Klinika nomi/telefoni — `src/config/brand.js` dan (avval 5 xil yozilardi)
- Cheklar umumiy `ReceiptHeader` komponentidan foydalanadi
- TV ekranidagi namuna telefon raqami haqiqiysiga almashtirildi

### Boshqa
- Bo'limlar `localStorage` dan bazaga ko'chdi (`service_categories`)
- Tizim nolga tushirildi (2026-08-16), zaxira: `backups/reset_oldidan_*.json`

---

## 5. Qilinishi kerak bo'lgan ishlar

### Egasi ko'rishi kerak
- [ ] **Ko'rinishni ko'z bilan tekshirish** — 30+ fayl o'zgardi, faqat build bilan
      tekshirilgan. Ayniqsa: bugungi bemorlar (telefonda), hisobotlar jadvallari
- [ ] **Chekni haqiqiy printerda** chiqarish — uchala turi
      (`ReceiptModal`, `PaymentTicketModal`, `InpatientReceiptModal`)
- [ ] Telefon va planshetda ishlatib ko'rish

### Kod tomonida
- [x] ~~Kunlik hisobot sekin~~ — **6.77s → 2.79s**. Sabab: hisobot ochilganda
      `sync_advances_and_salaries_to_expenses()` chaqirilardi, u esa yangi
      sessiya (yangi ulanish) ochib ~5 soniya olardi. Avans/oylik yozilganda
      harajat yozuvi allaqachon yaratiladi (`advances.py`, `employees.py`),
      shuning uchun hisobotda backfill kerak emas — chaqiruv olib tashlandi.
      Qolgan vaqt — so'rovlar soni × Tokiogacha masofa (bo'sh bazada ham
      13 so'rov ≈ 2.8s). Vercel'da (hnd1) ancha tez bo'ladi.
- [x] ~~Bir vaqtda ikki qurilmadan ro'yxatga olish~~ — **sinaldi, muammo yo'q.**
      Bitta admin akkaunti, 6 tadan bir vaqtda, 4 aylanish (24 bemor):
      navbat raqamlari takrorlanmadi, kassa markaz ulushiga aniq mos keldi,
      bemor va tranzaksiya soni teng. Aynan bir xil bemor ikki qurilmadan
      yuborilsa — biri 409 bilan to'xtatiladi.
      Eslatma: navbat raqami hali ham "o'qi-hisobla-yoz" usulida, ya'ni
      nazariy jihatdan poyga bor. 24 ta bir vaqtdagi so'rovda chiqmadi, lekin
      tezroq tarmoqda chiqishi mumkin. Butunlay xavfsiz qilish uchun bazada
      `(sana, ticket_number)` bo'yicha unique indeks kerak.
- [x] ~~Bir vaqtda ikki admin bir bemorni tahrirlaganda~~ — **ikkita xato topildi
      va tuzatildi.** Ilgari: (a) ikkalasi ham xizmat ro'yxatini almashtirsa,
      bemorda 2 barobar xizmat qatori qolardi (to'lov 100 000, xizmatlar
      jami 200 000); (b) ikkalasi ham bekor qilsa, ikkalasi ham o'tardi.
      Yechim: `_bemorni_qulflab_ol()` — `SELECT ... FOR UPDATE`.
      Yangi kod yozganda bemorni o'zgartirish oldidan shu yordamchidan foydalaning.
- [x] ~~Chek ichidagi ma'lumot bazaga mos kelishi~~ — 20 ta maydon tekshirildi,
      hammasi mos, to'lov qismlari yig'indisi ham aniq.
- [x] ~~Internet uzilganda / server xato qaytarganda~~ — `api.js` endi tushunarli
      xabar beradi ("Serverga ulanib bo'lmadi..." va h.k.). Ilgari inglizcha
      "Failed to fetch" chiqardi. Tarmoq uzilganda tizimdan chiqarib yubormaydi.
- [x] ~~`routers/reports.py` da ikkita bir xil `/top-referrers`~~ — o'lik
      nusxasi olib tashlandi, endi bitta marshrut qoldi
- [x] ~~`public/sw.js` ortiqcha~~ — tekshirildi va o'chirildi, PWA ishlayapti.
      **DIQQAT: `src/sw.js` ni O'CHIRMANG.** U `vite-plugin-pwa` ning
      `injectManifest` manba fayli (`vite.config.js` da `srcDir: 'src'`,
      `filename: 'sw.js'`). O'chirilsa build "Could not resolve entry module
      src/sw.js" xatosi bilan yiqiladi — bir marta shunday bo'lgan.
- [ ] `referrers.other_sum` ustuni endi ishlatilmaydi (`ozon_sum` almashtirdi)

### Muhit
- [ ] Backend vaqtincha **8010** portida ishlayapti. 8000 da eski soket osilib
      qolgan (14-avgustdan beri ishlab turgan jarayonlar to'xtatilgan, lekin
      Windows portni bo'shatmagan). Kompyuter qayta yuklangach:
      `frontend/.env.local` faylini o'chiring va 8000 ga qayting.
- [ ] `frontend/.env.local` ishlab chiqarishga tushmasin (`.gitignore` da bor)

---

## 6. Localda ishga tushirish

```bash
# Backend
cd backend && ./.venv/Scripts/python.exe -m uvicorn main:app --port 8010 --reload

# Frontend
cd frontend && npx vite --port 5173
```

Ochiladi: **http://localhost:5173** (`127.0.0.1:5173` ham ishlaydi)

`frontend/.env.local` ichida `VITE_DEV_API_TARGET=http://localhost:8010`.
Bu **faqat proksi** manzilini o'zgartiradi. `VITE_API_URL` ishlatmang — u
brauzerni backendga to'g'ridan-to'g'ri yuboradi va CORS bloklaydi.

---

## 7. Sinov usullari

Backendni to'g'ridan-to'g'ri sinash (server ishga tushirmasdan):

```python
import httpx, main as app_main
from auth_utils import create_access_token
tr = httpx.ASGITransport(app=app_main.app)
async with httpx.AsyncClient(transport=tr, base_url="http://t") as c:
    r = await c.get("/api/index.py",
                    params={"__v_path": "/api/reports/dashboard"},
                    headers={"Authorization": "Bearer " + tok})
```

Diqqat: `params` ichida `__v_path` bo'lishi shart — Vercel yo'l almashtirish
middleware'i shunga qarab ishlaydi. Skriptni **`backend/` papkasidan** ishga
tushiring, aks holda `.env` topilmay, bo'sh SQLite bazaga ulanib qoladi.
