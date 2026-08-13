import sys
import os

# Vercel'da fayl /var/task/api/index.py sifatida ishga tushadi
# Backend papkasi /var/task/backend/ da bo'ladi
_api_dir = os.path.dirname(os.path.abspath(__file__))          # /var/task/api
_root_dir = os.path.dirname(_api_dir)                          # /var/task
_backend_dir = os.path.join(_root_dir, "backend")              # /var/task/backend

for _p in [_backend_dir, _root_dir]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from main import app  # noqa: E402 — backend/main.py
