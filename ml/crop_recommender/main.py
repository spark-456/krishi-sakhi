from fastapi import FastAPI
import random

app = FastAPI(title="Crop Recommender — STUB")

CROPS = ["paddy", "wheat", "cotton", "maize", "soybean", "groundnut"]

@app.get("/health")
def health():
    return {"status": "ok", "mode": "stub"}

@app.post("/recommend")
async def recommend(data: dict):
    # STUB
    predicted = random.sample(CROPS, k=3)
    return {
        "recommended_crops": predicted,
        "confidence_score": round(random.uniform(0.8, 0.99), 3),
    }
