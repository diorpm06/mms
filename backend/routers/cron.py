"""Vercel Cron orqali chaqiriladigan hisobot/eslatma yo'nalishlari.

DIQQAT: `services/scheduler.py`dagi APScheduler faqat Vercel'dan TASHQARI
ishga tushadi (`main.py` — `if not os.environ.get("VERCEL")`), chunki
Vercel'da har bir so'rov o'z jarayonida yakunlangach jarayon muzlaydi —
ichki dastur soati soat 20:00'da hech qachon o'zi uyg'onib ishlay olmaydi.
Shu sababli kunlik/haftalik/oylik hisobotlar Telegram'ga HECH QACHON
avtomatik yuborilmagan edi.

Bu yerdagi yo'nalish Vercel'ning o'z tashqi soat xizmati (Cron Jobs)
tomonidan `vercel.json`da belgilangan vaqtda chaqiriladi — bu tashqi
HTTP so'rov, shuning uchun serverless muhitda ishonchli ishlaydi.
Ichidagi ish esa xuddi o'sha eski `job_*` funksiyalarining o'zi —
faqat endi ularni chaqiradigan "soat" ichki emas, tashqi.
"""
import os
from datetime import date, timedelta

from fastapi import APIRouter, Header, HTTPException

router = APIRouter(prefix="/api/cron", tags=["cron"])


def _ruxsatni_tekshir(authorization: str | None):
    """Vercel Cron `CRON_SECRET` muhit o'zgaruvchisi sozlangan bo'lsa,
    har bir chaqiruvga `Authorization: Bearer <CRON_SECRET>` sarlavhasini
    o'zi qo'shib yuboradi — shu orqali tasodifiy odam URL'ni bilib olib
    hisobotni qayta-qayta yubortirib yubormasligini tekshiramiz.
    Hali sozlanmagan bo'lsa (birinchi joylashtirishda) — cheklov
    qo'yilmaydi, aks holda sozlanmaguncha yo'nalish umuman ishlamay
    qolardi."""
    maxfiy = os.environ.get("CRON_SECRET")
    if not maxfiy:
        return
    if authorization != f"Bearer {maxfiy}":
        raise HTTPException(status_code=401, detail="Ruxsat yo'q")


def _oy_oxirgi_kunimi(d: date) -> bool:
    keyingi_oy_boshi = d.replace(day=28) + timedelta(days=4)
    oxirgi_kun = keyingi_oy_boshi - timedelta(days=keyingi_oy_boshi.day)
    return d == oxirgi_kun


@router.get("/run-daily")
def cron_run_daily(authorization: str | None = Header(default=None)):
    """Vercel har kuni bir marta (12:00 UTC = 17:00 Toshkent) chaqiradi.
    Shu ichida qaysi hisobotlar aynan bugun yuborilishi kerakligini
    o'zi hal qiladi — xuddi ilgari APScheduler har biri uchun alohida
    jadval bilan qilgani kabi."""
    _ruxsatni_tekshir(authorization)

    from services.scheduler import (
        job_daily_report,
        job_monthly_report_and_salary,
        job_ten_day_payout,
        job_weekly_report,
    )

    natija: dict[str, str] = {}

    def _ishga_tushir(nom, fn):
        try:
            fn()
            natija[nom] = "OK"
        except Exception as e:  # noqa: BLE001 — hisobot xatosi boshqasini to'xtatmasin
            natija[nom] = f"XATO: {e}"

    _ishga_tushir("daily_report", job_daily_report)

    bugun = date.today()
    oxirgi_kunmi = _oy_oxirgi_kunimi(bugun)

    if bugun.weekday() == 6:  # yakshanba
        _ishga_tushir("weekly_report", job_weekly_report)

    if bugun.day in (10, 20) or oxirgi_kunmi:
        _ishga_tushir("ten_day_payout", job_ten_day_payout)

    if oxirgi_kunmi:
        _ishga_tushir("monthly_report_and_salary", job_monthly_report_and_salary)

    return {"sana": bugun.isoformat(), "natijalar": natija}
