# Marjona Med Service — Chop etish agenti

Bu dastur tizimdagi "Chop etish" tugmasi bosilganda, qaysi qurilmadan
(telefon, boshqa kompyuter) bosilishidan qat'iy nazar, shu kompyuterga
ulangan printerga avtomatik chiqarib beradi.

## O'rnatish (har bir printer ulangan kompyuterda alohida qilinadi)

### 1-qadam: Python o'rnatish
Agar kompyuterda Python bo'lmasa: Microsoft Store'ni oching, "Python" deb
qidiring, so'nggi versiyasini (3.11+) o'rnating. Yoki https://python.org
saytidan yuklab oling — o'rnatishda **"Add Python to PATH"** katakchasini
belgilashni unutmang.

### 2-qadam: Bu papkani kompyuterga nusxalash
`print-agent` papkasini shu kompyuterning istalgan joyiga (masalan
Desktop'ga) nusxalang.

### 3-qadam: Sozlash
`config.ini.example` faylini nusxalab, nomini `config.ini` ga o'zgartiring.
Uni oching va quyidagilarni to'ldiring:

- `api_base` — saytingiz manzili (masalan `https://mms-coral.vercel.app`)
- `agent_token` — menga (Claude'ga) so'rab oling, u sizga aytadi
- `location_key` — bu kompyuter qaysi joy ekanini yozing:
  - Klinikadagi (Admin/Registratura) kompyuter uchun: `admin_main`
  - Rahbarning uyidagi kompyuteri uchun: `ceo_home`

### 4-qadam: Standart printerni tekshirish
Windows Sozlamalar → Printerlar va skanerlar bo'limida, shu kompyuterga
kerakli printer **"Standart" (Default)** qilib belgilanganiga ishonch
hosil qiling — agent doim shu printerga chiqaradi.

### 5-qadam: Ishga tushirish
`start.bat` faylini ikki marta bosing. Qora oyna ochiladi va "Chop etish
agenti ishga tushdi" deb yozadi — shu oyna ochiq turishi kerak (yopmang).

### 6-qadam (ixtiyoriy): Kompyuter yoqilganda avtomatik ishga tushishi
`start.bat` faylining yorlig'ini (shortcut) yaratib, uni quyidagi papkaga
joylashtiring:
```
Win+R tugmalarini bosing, "shell:startup" deb yozib Enter bosing —
ochilgan papkaga start.bat yorlig'ini tashlang.
```
Shundan keyin kompyuter har safar yoqilganda agent o'zi ishga tushadi.

## Ikkala joy uchun ham shu qadamlarni takrorlang
- Klinikadagi kompyuterda: `location_key = admin_main`
- Rahbar uyidagi kompyuterda: `location_key = ceo_home`

## Tekshirish
Tizimda biror joydan "Chop etish" tugmasini bosing — bir necha soniya
ichida tegishli kompyuterdagi printer o'zi ishga tushib, qog'oz chiqishi
kerak. Agar chiqmasa, agent oynasidagi xabarlarni ko'ring — u yerda xato
sababi yozilgan bo'ladi.
