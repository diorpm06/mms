# Antigravity uchun topshiriq — mustaqil test

> Bu matnni Antigravity'ga to'liq nusxalab bering.

---

Sen **mustaqil tekshiruvchisan**, dasturchi emas. Vazifang — Marjona Med Servis
CRM tizimini noldan sinab ko'rish va **hisobot yozish**.

## ⛔ QAT'IY QOIDALAR — buzilmasin

1. **HECH QANDAY FAYLNI O'ZGARTIRMA.** Kod, sozlama, CSS — hech biriga tegma.
   Xato topsang — **tuzatma**, faqat yozib qo'y. Tuzatishni egasi hal qiladi.
2. **`git commit` va `git push` QILMA.** Ishchi papkada 60+ yuborilmagan
   o'zgarish bor, ular boshqa vosita tomonidan qilingan va hali tekshirilmagan.
   `git add`, `git checkout`, `git restore` ham qilma.
3. **Baza HAQIQIY** — Supabase'dagi ishlab turgan baza. Hozir u **butunlay
   nolda** (bemor 0, kassa 0, balanslar 0) va ertangi test uchun shunday
   turishi kerak.
4. Sinov ma'lumoti yaratsang:
   - ismi **`ZZ`** bilan boshlansin (masalan `ZZTEST Sinov`)
   - ish tugagach **hammasini o'chir**
   - oxirida baza yana nolda ekanini **tekshirib ko'rsat**
5. Har bir bemor yaratganingda tizim **Telegramga xabar yuboradi** — klinika
   kanaliga keraksiz xabar ketmasligi uchun kamroq yozuv yarat.

## Boshlashdan oldin

`marjona-med/AGENTS.md` faylini o'qi. Unda tizimning muhim qoidalari yozilgan:
komissiya qanday hisoblanadi, qaysi shifokorlar 100% oladi, UZI qoidasi va h.k.
**O'sha qoidalarga qarab tekshir** — o'zingdan qoida o'ylab topma.

## Muhit

```
Backend :  cd backend && ./.venv/Scripts/python.exe -m uvicorn main:app --port 8010
Frontend:  cd frontend && npx vite --port 5173
Ochiladi:  http://localhost:5173
Rahbar  :  Dima / dima7777
```

Backendni to'g'ridan-to'g'ri sinash uchun (server ishga tushirmasdan):

```python
# backend/ papkasidan ishga tushir, aks holda .env topilmaydi
import httpx, main as app_main
from auth_utils import create_access_token
tr = httpx.ASGITransport(app=app_main.app)
async with httpx.AsyncClient(transport=tr, base_url="http://t") as c:
    r = await c.get("/api/index.py",
                    params={"__v_path": "/api/reports/daily", "date": "2026-08-17"},
                    headers={"Authorization": "Bearer " + tok})
```

`params` ichida `__v_path` bo'lishi **shart** — Vercel yo'l almashtirish
middleware'i shunga qarab ishlaydi.

## Nimani tekshirish kerak

### 1. Pul hisobi (eng muhim)
- Har bir bo'limdan bittadan bemor yozib ko'r: Laboratoriya, Fizioterapiya,
  Uzi, Ozonaterapiya, Massaj, Ineksiya, Maslaxat
- Har birida tekshir: **yo'naltiruvchi + shifokor + markaz = to'lov**
- `AGENTS.md` dagi tariflarga mos keladimi (lab 22%, fizio 20%, Uzi 15 000,
  Ozon 10 000, qolganlari 0)
- `Uzi (qo'shimcha)` xizmatiga komissiya berilmasligi kerak
- Dr. Umida va Dr. Soxiba (Maslaxat) — to'lovni to'liq o'zlari oladi

### 2. Chegirma
- Chegirma bilan bemor yoz, chekda va hisobotda to'g'ri chiqadimi
- Chegirma narxdan katta bo'lsa rad etiladimi

### 3. Tahrirlash va bekor qilish
- Bemorni tahrirla — summalar qayta hisoblanadimi
- Xizmat qo'sh/olib tashla — to'lov o'zgaradimi
- Bekor qil — balanslar orqaga qaytadimi
- Bekor qilinganni yana bekor qilib ko'r

### 4. Navbat raqami
- Bir necha bemor yoz, raqamlar ketma-ket ketadimi
- Bittasini o'chir, keyin yangi bemor yoz — **raqam takrorlanmasligi kerak**

### 5. Hisobotlar
- Kunlik, 10-kunlik, oylik hisobotlar ochiladimi
- Rahbar panelidagi raqamlar bemorlar ro'yxatiga mos keladimi
- Kassa qoldig'i = tushum − chiqim ekanini tekshir

### 6. Ro'llar
- Admin rahbarga tegishli joyga kira oladimi (kira olmasligi kerak)
- Shifokor faqat o'z navbatini ko'radimi

### 7. Ko'rinish (brauzerda)
- Telefon o'lchamida (375px) sahifalar sinmaydimi
- Jadvallar ekrandan chiqib ketmaydimi
- Kun va tun rejimida yozuvlar ko'rinadimi
- Oynalar (modal) aylantiriladimi, yopiladimi
- ⋮ menyusi to'g'ri ochiladimi, tashqariga bosilganda yopiladimi

### 8. Boshqa modullar
Statsionar, omborxona, kalendar, yozishmalar, dejurlik, TV ekrani — ishlaydimi

## Hisobot qanday bo'lishi kerak

Har bir topilgan kamchilik uchun:

```
MUAMMO: [bir jumlada nima noto'g'ri]
QAYERDA: [sahifa yoki fayl:qator]
QANDAY TAKRORLASH: [1-qadam, 2-qadam, 3-qadam]
KUTILGAN: [nima bo'lishi kerak edi]
HAQIQATDA: [nima bo'ldi]
JIDDIYLIGI: [pul yo'qoladi / ish to'xtaydi / noqulay / kichik]
```

Oxirida:
- Nechta narsa sinaldi, nechtasida muammo topildi
- **Baza yana nolda ekanini ko'rsat** (bemor 0, kassa 0, balanslar 0)
- Sinov ma'lumotlaring o'chirilganini tasdiqla

## Yana bir eslatma

Agar biror narsa xato ko'rinsa, lekin `AGENTS.md` da "shunday bo'lishi kerak"
deb yozilgan bo'lsa — u xato emas. Masalan Maslaxatda markazga 0 tushishi
ataylab shunday.

Ishonchsiz bo'lsang — **taxmin qilma, so'ra.**
