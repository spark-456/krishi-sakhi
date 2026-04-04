from fastapi import FastAPI
import random

app = FastAPI(title="Price Forecaster — STUB")

@app.get("/health")
def health():
    return {"status": "ok", "mode": "stub"}

@app.post("/forecast")
async def forecast(data: dict):
    # STUB
    base_price = random.uniform(2000, 4000)
    return {
        "crop": data.get("crop_name", "unknown"),
        "current_price_inr": round(base_price, 2),
        "predicted_30_day_price_inr": round(base_price * random.uniform(0.9, 1.1), 2),
        "trend": random.choice(["up", "down", "stable"])
    }
