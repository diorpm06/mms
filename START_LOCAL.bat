@echo off
title Marjona Med CRM Launch
echo ========================================================
echo   Marjona Med CRM - Lokal Serverni Ishga Tushirish
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Backend (FastAPI) serverini ishga tushirish...
start "Marjona Med Backend (Port 8000)" cmd /k "cd backend && .venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo [2/2] Frontend (Vite React) serverini ishga tushirish...
start "Marjona Med Frontend (Port 5173)" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo   Serverlar ishga tushdi!
echo   Frontend (Brauzer): http://localhost:5173
echo   Backend API Docs:   http://localhost:8000/docs
echo ========================================================
echo.
pause
