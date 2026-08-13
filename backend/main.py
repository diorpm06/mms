import logging
from contextlib import asynccontextmanager

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
    advances, appointments, audit, auth, balance, banners, cash, chat, duty, employees, expenses,
    incassation, inpatients, inventory, lab_results, notifications, patients, payroll, providers, queue, referrers, reports, services, sheets_backup, webhook,
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

# Rate limiter (global, IP asosida)
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.environ.get("VERCEL"):
        try:
            Base.metadata.create_all(bind=engine)
            run_migrations()
            if start_sheet_worker:
                start_sheet_worker()
            if start_scheduler:
                start_scheduler()
        except Exception as e:
            logger.error(f"Startup warning: {e}")
    else:
        # Vercel serverless: faqat DB connection tekshiramiz
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            logger.warning(f"Vercel DB init warning: {e}")
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/api/debug-files")
def debug_files():
    import glob
    files = glob.glob("/var/task/**", recursive=True)
    return {
        "cwd": os.getcwd(),
        "this_dir": _THIS_DIR,
        "root_dir": _ROOT_DIR,
        "frontend_dist": FRONTEND_DIST,
        "index_html_exists": INDEX_HTML and os.path.exists(INDEX_HTML),
        "files_count": len(files),
        "files_matching_dist": [f for f in files if "dist" in f][:30]
    }


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


@app.get("/")
async def serve_root():
    """Root URL — 404.html usuli Vercel'da SPA routing boshqaradi"""
    return {"status": "ok", "message": "Marjona Med Service API ishlayapti"}
