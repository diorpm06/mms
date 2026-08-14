import sys
import os

_api_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.dirname(_api_dir)
_backend_dir = os.path.join(_root_dir, "backend")

for _p in [_backend_dir, _root_dir]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from main import app  # noqa: E402
