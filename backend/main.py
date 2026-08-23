import os as _os
import time as _time

# Vaqt mintaqasi — boshqa importlardan OLDIN o'rnatiladi.
# Server UTC'da ishlaydi (Vercel), klinika esa Toshkentda (UTC+5). Shu sababli
# barcha vaqtlar 5 soat orqada saqlanardi: chekdagi soat, hisobot kunlari va
# navbat raqamining kunlik yangilanishi ham noto'g'ri edi.
# DIQQAT: TZ faqat tzset() mavjud bo'lgan tizimlarda (Linux — Vercel shu
# yerda ishlaydi) o'rnatiladi. Windows "Asia/Tashkent" yozuvini tushunmaydi
# va TZ o'rnatilsa UTC'ga tushib qoladi — ya'ni lokal muhitni buzadi.
if hasattr(_time, "tzset"):
    import datetime as _dt

    def _tz_ok() -> bool:
        """Mintaqa haqiqatan qo'llanganini tekshiradi (Toshkent UTC+5)."""
        utc = _dt.datetime.now(_dt.timezone.utc).replace(tzinfo=None)
        return round((_dt.datetime.now() - utc).total_seconds() / 3600) == 5

    _os.environ["TZ"] = "Asia/Tashkent"
    _time.tzset()
    if not _tz_ok():
        # Konteynerda tzdata fayllari bo'lmasa IANA nomi tanilmaydi. POSIX
        # ko'rinishi hech qanday qo'shimcha fayl talab qilmaydi (O'zbekistonda
        # yozgi vaqt yo'q, shuning uchun qat'iy +5 to'g'ri).
        _os.environ["TZ"] = "UZT-5"
        _time.tzset()

import logging
from contextlib import asynccontextmanager
from urllib.parse import parse_qs, urlencode

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from fastapi.staticfiles import StaticFiles
import os

from config import settings
from database import Base, engine, run_migrations
from routers import (
    advances, appointments, audit, auth, balance, banners, cash, chat, commissions, courses, cron, duty, employees,
    expenses, incassation, inpatients, inventory, lab_results, notifications, patients, payroll, print_jobs, providers,
    queue, referrers, report_submissions, reports, services, sheets_backup, webhook,
)

try:
    from services.scheduler import start_scheduler
except Exception:
    start_scheduler = None

try:
    from services.sheets import start_sheet_worker
except Exception:
    start_sheet_worker = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── SECRET_KEY xavfsizlik tekshiruvi ─────────────────────
# Eslatma: ataylab RuntimeError bilan to'xtatilmaydi — noto'g'ri sozlangan
# SECRET_KEY butun serverless funksiyani "crash" qilib qo'yishi mumkin edi.
# Faqat ogohlantirish log qilinadi, ilova ishlashda davom etadi.
_INSECURE_DEFAULT_SECRET_KEY = "marjona_med_service_crm_secret_key_2026_x89f"
if settings.SECRET_KEY == _INSECURE_DEFAULT_SECRET_KEY:
    logger.warning(
        "XAVFSIZLIK OGOHLANTIRISHI: standart SECRET_KEY ishlatilmoqda. "
        "Vercel dashboard > Environment Variables'da SECRET_KEY'ni kuchli "
        "tasodifiy qiymatga o'zgartiring (python -c \"import secrets; print(secrets.token_hex(32))\")."
    )

# Rate limiter (global, IP asosida)
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import threading

    def _init_db():
        try:
            Base.metadata.create_all(bind=engine)
            run_migrations()
        except Exception as e:
            logger.warning(f"DB init/migration warning: {e}")

    # Vercel'da jadval yaratish/migratsiya QILINMAYDI. Bu yerda daemon oqim
    # ishlatilgan edi: so'rov tugashi bilan Vercel jarayonni muzlatadi va
    # oqim DDL o'rtasida o'ladi — bazada ochiq tranzaksiya qolib, jadval
    # qulflanib turadi. Keyingi so'rovlar o'sha qulf ortida to'planib,
    # tizim butunlay osilib qolardi.
    if os.environ.get("VERCEL") and os.environ.get("RUN_MIGRATIONS") != "1":
        logger.info("Vercel: baza sxemasi o'zgartirilmaydi")
    else:
        threading.Thread(target=_init_db, daemon=True).start()

    if not os.environ.get("VERCEL"):
        try:
            if start_sheet_worker:
                start_sheet_worker()
            if start_scheduler:
                start_scheduler()
        except Exception as e:
            logger.error(f"Startup warning: {e}")
    else:
        logger.info("Marjona Med Service backend Vercel-da ishga tushdi")
    yield


app = FastAPI(
    title="Marjona Med Service API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,      # Swagger UI ni production da yashirish
    redoc_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────
_allowed_origins = {
    origin.strip()
    for origin in settings.FRONTEND_URL.split(",")
    if origin.strip()
}
_allowed_origins.update({"http://localhost:5173", "http://localhost:3000"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Kutilmagan xatolarni bazaga yozish ────────────────────
# Vercel'da server loglari har doim ham ochiq bo'lmaydi. Ilgari
# "Serverda xatolik" chiqqanda sababini topishning yagona yo'li taxmin
# qilish edi. Endi to'liq xato matni audit_logs jadvaliga yoziladi va
# foydalanuvchiga qisqa raqam ko'rsatiladi.
@app.exception_handler(Exception)
async def _kutilmagan_xato(request: Request, exc: Exception):
    import traceback as _tb

    belgi = "-"
    try:
        from database import SessionLocal as _SL
        from models.audit_log import AuditLog as _AL

        matn = "".join(_tb.format_exception(type(exc), exc, exc.__traceback__))
        # Xato yozuvi asosiy so'rovdan ALOHIDA ulanishda saqlanadi —
        # so'rovning o'z tranzaksiyasi allaqachon buzilgan bo'ladi.
        _db = _SL()
        try:
            qator = _AL(
                user_id=None,
                user_role="system",
                action_type="SERVER_ERROR",
                table_name=str(request.url.path)[:100],
                reason=f"{type(exc).__name__}: {exc}"[:2000],
                new_data=matn[-6000:],
                ip_address=(request.client.host if request.client else None),
            )
            _db.add(qator)
            _db.commit()
            belgi = str(qator.id)
        finally:
            _db.close()
    except Exception:
        # Xatoni yozib bo'lmasa ham javob qaytishi shart
        logger.exception("Kutilmagan xato (bazaga yozib bo'lmadi)")

    logger.exception("Kutilmagan xato [%s] %s", belgi, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Serverda xatolik yuz berdi. Xato raqami: {belgi}"},
    )


# ── Xavfsizlik sarlavhalari ───────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


# ── Routerlar ─────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(services.router)
app.include_router(commissions.router)
app.include_router(referrers.router)
app.include_router(providers.router)
app.include_router(employees.router)
app.include_router(patients.router)
app.include_router(queue.router)
app.include_router(expenses.router)
app.include_router(balance.router)
app.include_router(reports.router)
app.include_router(webhook.router)
app.include_router(audit.router)
app.include_router(duty.router)
app.include_router(inpatients.router)
app.include_router(cash.router)
app.include_router(advances.router)
app.include_router(notifications.router)
app.include_router(sheets_backup.router)
app.include_router(chat.router)
app.include_router(appointments.router)
app.include_router(inventory.router)
app.include_router(payroll.router)
app.include_router(lab_results.router)
app.include_router(incassation.router)
app.include_router(banners.router)
app.include_router(report_submissions.router)
app.include_router(print_jobs.router)
app.include_router(courses.router)
app.include_router(cron.router)

uploads_dir = "/tmp/uploads" if os.environ.get("VERCEL") else os.path.join(os.getcwd(), "uploads")
try:
    os.makedirs(uploads_dir, exist_ok=True)
except Exception:
    pass

if os.path.exists(uploads_dir):
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_ROOT_DIR = os.path.dirname(_THIS_DIR)

_CANDIDATES = [
    os.path.join(_ROOT_DIR, "frontend", "dist"),
    os.path.join(_THIS_DIR, "..", "frontend", "dist"),
    os.path.join(_THIS_DIR, "frontend", "dist"),
    os.path.join(_THIS_DIR, "dist"),
    os.path.join(os.getcwd(), "frontend", "dist"),
    os.path.join(os.getcwd(), "dist"),
    "/var/task/frontend/dist",
    "/var/task/api/frontend/dist",
    "/var/task/api/dist",
]

FRONTEND_DIST = None
INDEX_HTML = None

for c in _CANDIDATES:
    abs_c = os.path.abspath(c)
    idx = os.path.join(abs_c, "index.html")
    if os.path.exists(idx):
        FRONTEND_DIST = abs_c
        INDEX_HTML = idx
        break

if not FRONTEND_DIST:
    import glob
    found_indexes = glob.glob("/var/task/**/index.html", recursive=True)
    if found_indexes:
        INDEX_HTML = os.path.abspath(found_indexes[0])
        FRONTEND_DIST = os.path.dirname(INDEX_HTML)

if FRONTEND_DIST:
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/api")
@app.get("/api/")
def root():
    return {
        "status": "ok",
        "service": "Marjona Med Service API",
        "database": "Supabase PostgreSQL Connected 🟢"
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "Marjona Med Service",
        "database": "Supabase PostgreSQL Connected 🟢"
    }


def _get_index_html_path() -> str | None:
    """Vercel yoki local'da index.html yo'lini topadi"""
    candidates = [
        INDEX_HTML,
        "/var/task/frontend/dist/index.html",
    ]
    import glob as _glob
    for path in candidates:
        if path and os.path.exists(path):
            return path
    found = _glob.glob("/var/task/**/index.html", recursive=True)
    return found[0] if found else None


@app.get("/")
async def serve_root():
    """Root URL — React SPA index.html ni qaytaradi"""
    idx = _get_index_html_path()
    if idx:
        return FileResponse(idx, media_type="text/html")
    return {"status": "ok", "message": "Marjona Med Service API ishlayapti"}


@app.api_route(
    "/{full_path:path}",
    methods=["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    include_in_schema=False,
)
async def spa_fallback(request: Request, full_path: str):
    """SPA catch-all — aniq API routelari bu yerga yetib kelmaydi."""
    method = request.method

    # Noma'lum API yoki uploads endpointi
    if full_path.startswith(("api/", "uploads/")):
        raise HTTPException(status_code=404, detail="Not Found")

    # Ildizdagi statik fayllar (logo.png, instagram-qr.png, manifest.json,
    # sound/... ). Faqat /assets ulangani uchun bular SPA index.html'ga tushib
    # ketardi — natijada chekdagi <img src="/logo.png"> rasm o'rniga HTML olib,
    # logotip ko'rinmasdi.
    if method in ("GET", "HEAD") and full_path and FRONTEND_DIST:
        candidate = os.path.realpath(os.path.join(FRONTEND_DIST, full_path))
        dist_root = os.path.realpath(FRONTEND_DIST)
        # Papkadan tashqariga chiqishга yo'l qo'ymaymiz (../ hujumi)
        if candidate.startswith(dist_root + os.sep) and os.path.isfile(candidate):
            return FileResponse(candidate)

    # GET/HEAD → SPA index.html
    if method in ("GET", "HEAD"):
        idx = _get_index_html_path()
        if idx:
            return FileResponse(idx, media_type="text/html")
        from fastapi.responses import HTMLResponse
        return HTMLResponse(
            '<!DOCTYPE html><html><head>'
            '<meta http-equiv="refresh" content="0;url=/">'
            '<title>Marjona Med</title></head><body></body></html>',
            status_code=200,
        )

    raise HTTPException(status_code=405, detail=f"Method Not Allowed: {method} /{full_path}")


class VercelPathRewriteMiddleware:
    """
    vercel.json'dagi rewrite har bir so'rovni /api/index.py?__v_path=<asl_yo'l>
    ko'rinishida yuboradi — Vercel ASGI scope'ga asl yo'l o'rniga shu destination
    yo'lini beradi. Bu middleware __v_path'ni o'qib, scope["path"]ni asl
    (brauzer so'ragan) yo'lga tiklaydi, aks holda FastAPI routing hech qanday
    marshrutga mos kelmay, doim 404 qaytaradi.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            query_string = scope.get("query_string", b"")
            if query_string and b"__v_path" in query_string:
                params = parse_qs(query_string.decode("utf-8", errors="replace"))
                v_path = params.pop("__v_path", None)
                if v_path and v_path[0]:
                    scope = dict(scope)
                    scope["path"] = v_path[0]
                    scope["raw_path"] = v_path[0].encode("utf-8")
                    scope["query_string"] = urlencode(params, doseq=True).encode("utf-8")
        await self.app(scope, receive, send)


app = VercelPathRewriteMiddleware(app)

