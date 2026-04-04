from fastapi import FastAPI, UploadFile, File, Form
from uuid import UUID
import random

app = FastAPI(title="Soil Classifier — STUB")

CLASSES = ["clay", "loam", "sandy", "red", "black", "alluvial"]

@app.get("/health")
def health():
    return {"status": "ok", "mode": "stub"}

@app.get("/version")
def version():
    return {"version": "0.0.1-stub", "model": "YOLOv8n-stub"}

@app.post("/classify")
async def classify(
    image: UploadFile = File(...),
    farm_id: str = Form(...),
    farmer_id: str = Form(...),
):
    # STUB: returns random class. Replace with real model in Phase 7.
    await image.read()  # consume bytes, do not store
    predicted = random.choice(CLASSES)
    return {
        "predicted_soil_class": predicted,
        "confidence_score": round(random.uniform(0.75, 0.97), 3),
        "farm_id": farm_id,
        "farmer_id": farmer_id,
    }
