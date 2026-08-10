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

from services.scheduler import start_scheduler
from services.sheets import start_sheet_worker

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
            start_sheet_worker()
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

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
assets_dir = os.path.join(frontend_dist, "assets")

if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/")
def root():
    index_path = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"status": "ok", "service": "Marjona Med Service API"}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Marjona Med Service"}


@app.get("/{full_path:path}")
def catch_all(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("uploads/"):
        raise HTTPException(status_code=404, detail="Not Found")
    index_path = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Not Found")
