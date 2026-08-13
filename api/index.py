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

from main import app as _fastapi_app  # noqa: E402 — backend/main.py


class _VercelPathFixer:
    """Vercel /api/(.*) rewrite'dan keyin path'ni tiklaydi.

    Vercel `api/index.py` funksiyasiga so'rov yuborayotganda ba'zan
    /api/ prefixini olib tashlaydi. Masalan:
      Browser: POST /api/auth/login
      Vercel:  POST /auth/login  → funksiyaga
    Bu wrapper /api prefixi yo'qligini aniqlasa qaytarib qo'yadi.
    """

    _STATIC_PREFIXES = (
        "/assets/", "/sw.js", "/sw.mjs", "/manifest.webmanifest",
        "/favicon", "/logo", "/icon", "/robots.txt",
    )

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            path: str = scope.get("path", "/")

            # Agar path /api bilan boshlanmasa VA statik fayl emas va root emas
            needs_prefix = (
                path != "/"
                and not path.startswith("/api")
                and not path.startswith("/uploads")
                and not any(path.startswith(p) for p in self._STATIC_PREFIXES)
            )
            if needs_prefix:
                new_path = "/api" + path
                scope = dict(scope)
                scope["path"] = new_path
                qs = scope.get("query_string", b"")
                scope["raw_path"] = (new_path + (("?" + qs.decode()) if qs else "")).encode()

        await self.app(scope, receive, send)


# Vercel `app` o'zgaruvchisini kutadi
app = _VercelPathFixer(_fastapi_app)
