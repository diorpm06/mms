import sys
import os
import urllib.parse

_api_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.dirname(_api_dir)
_backend_dir = os.path.join(_root_dir, "backend")

for _p in [_backend_dir, _root_dir]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from main import app as _fastapi_app  # noqa: E402


class _VercelPathRestore:
    """Vercel rewrite qo'shgan __v_path query param'dan original path'ni tiklaydi.

    Vercel rewrite: /(.*) → /api/index.py?__v_path=/$1
    ASGI scope path: /api/index.py  (Vercel tomonidan o'zgartirilgan)
    query_string: __v_path=/api/auth/login (original path)

    Bu middleware query string'dan __v_path'ni o'qib, scope path'ni tiklaydi.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            qs = scope.get("query_string", b"").decode()
            if "__v_path" in qs:
                params = dict(urllib.parse.parse_qsl(qs))
                orig_path = params.pop("__v_path", None)
                if orig_path:
                    scope = dict(scope)
                    scope["path"] = orig_path
                    if "raw_path" in scope:
                        scope["raw_path"] = orig_path.encode()
                    # Qolgan original query stringni saqlaymiz
                    new_qs = urllib.parse.urlencode(params)
                    scope["query_string"] = new_qs.encode()
        await self.app(scope, receive, send)


# Vercel `app` o'zgaruvchisini kutadi
app = _VercelPathRestore(_fastapi_app)
