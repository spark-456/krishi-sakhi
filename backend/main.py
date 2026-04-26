import socket
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import farms, crops, expenses, activity, advisory, ml_scans, auth, weather, ml_insights
from routers import admin as admin_router, tickets, blog, cooperative

# ---------------------------------------------------------------------------
# LAN IP detection — logs accessible URL for phone testing on same Wi-Fi
# ---------------------------------------------------------------------------
def _get_lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"

_LAN_IP = _get_lan_ip()

# ---------------------------------------------------------------------------
# CORS — allow localhost dev origins + LAN IP for phone access
# ---------------------------------------------------------------------------
_CORS_ORIGINS = [
    "http://localhost:5173",
    "https://localhost:5173",
    "http://localhost:4173",
    "https://localhost:4173",
    "http://localhost:5174",
    "http://localhost:5175",
    f"https://{_LAN_IP}:5173",
    f"http://{_LAN_IP}:5173",
]

app = FastAPI(title="Krishi Sakhi API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(farms.router, prefix="/api/v1")
app.include_router(crops.router, prefix="/api/v1")
app.include_router(expenses.router, prefix="/api/v1")
app.include_router(activity.router, prefix="/api/v1")
app.include_router(advisory.router, prefix="/api/v1")
app.include_router(ml_scans.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1/auth")
app.include_router(weather.router, prefix="/api/v1")
app.include_router(ml_insights.router, prefix="/api/v1")
app.include_router(admin_router.router, prefix="/api/v1")
app.include_router(tickets.router, prefix="/api/v1")
app.include_router(blog.router, prefix="/api/v1")
app.include_router(cooperative.router, prefix="/api/v1")


@app.on_event("startup")
async def _startup_log():
    port = settings.backend_port if hasattr(settings, "backend_port") else 8000
    print(f"\n{'='*55}")
    print(f"  Krishi Sakhi Backend  v1.1.0")
    print(f"  Local  -> http://localhost:{port}")
    print(f"  Phone  -> http://{_LAN_IP}:{port}  (same Wi-Fi)")
    print(f"  Docs   -> http://localhost:{port}/docs")
    print(f"{'='*55}\n")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.1.0", "lan_ip": _LAN_IP}
