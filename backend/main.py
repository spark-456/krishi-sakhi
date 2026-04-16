from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import farms, crops, expenses, activity, advisory, ml_scans, auth, weather

app = FastAPI(title="Krishi Sakhi API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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

@app.get("/health")
async def health():
    return {"status": "ok"}
