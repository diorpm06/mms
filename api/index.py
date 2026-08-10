import sys
import os
import traceback

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, "backend")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if root_dir not in sys.path:
    sys.path.insert(1, root_dir)

try:
    from main import app
except Exception as e:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    
    err_str = str(e)
    tb_str = traceback.format_exc()
    print("Vercel Serverless Init Error:\n", tb_str)
    
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    @app.get("/")
    @app.get("/api/health")
    @app.get("/{full_path:path}")
    def fallback_error(full_path: str = ""):
        return {
            "status": "error",
            "message": "Backend initialization error",
            "error": err_str,
            "traceback": tb_str[-1000:]
        }
