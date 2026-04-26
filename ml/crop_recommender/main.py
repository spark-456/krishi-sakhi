from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
import os
import joblib
import json
import xgboost as xgb

app = FastAPI(title="Crop Recommender API - Using XGBoost")

# Helper to find file whether running from root dir or inside microservice dir
def get_path(filename):
    for prefix in ["ml/crop_recommender/", ""]:
        path = os.path.join(prefix, filename)
        if os.path.exists(path):
            return path
    return filename

XGB_MODEL_PATH = get_path("crop_trend_xgb.json")
LABEL_ENC_PATH = get_path("crop_label_encoder.pkl")
LOC_ENC_PATH = get_path("location_encoder.pkl")
FEATURES_PATH = get_path("crop_features.json")

is_stub = not (
    os.path.exists(XGB_MODEL_PATH) and
    os.path.exists(LABEL_ENC_PATH) and
    os.path.exists(LOC_ENC_PATH) and
    os.path.exists(FEATURES_PATH)
)

if not is_stub:
    model = xgb.XGBClassifier()
    model.load_model(XGB_MODEL_PATH)
    label_encoder = joblib.load(LABEL_ENC_PATH)
    location_encoder = joblib.load(LOC_ENC_PATH)
    with open(FEATURES_PATH, "r") as f:
        features_list = json.load(f)
else:
    model = None
    label_encoder = None
    location_encoder = None
    features_list = []

class FeaturesReq(BaseModel):
    location: str
    rainfall: float
    monsoon_rainfall: float
    temperature: float
    humidity: float
    wind_speed: float
    yield_est: float = 0.0

@app.get("/health")
def health():
    return {"status": "ok", "mode": "ml-xgb" if not is_stub else "stub"}

@app.post("/recommend")
async def recommend(data: FeaturesReq):
    if is_stub:
        import random
        crops = ["Rice", "Wheat", "Maize", "Cotton", "Sugarcane"]
        return {
            "top_recommendation": random.choice(crops),
            "confidence": round(random.uniform(0.7, 0.95), 3),
            "alternatives": [],
            "mode": "stub"
        }
    
    loc_val = 0
    if data.location in location_encoder.classes_:
        loc_val = location_encoder.transform([data.location])[0]
        
    X = pd.DataFrame([{
        "location_enc": loc_val,
        "rainfall": data.rainfall,
        "monsoon_rainfall": data.monsoon_rainfall,
        "temperature": data.temperature,
        "humidity": data.humidity,
        "wind_speed": data.wind_speed,
        "yield": data.yield_est
    }])
    
    # Must use the exact order
    for col in features_list:
        if col not in X.columns:
            X[col] = 0
    X = X[features_list]
    
    proba = model.predict_proba(X)[0]
    idx = np.argsort(proba)[::-1]
    
    return {
        "top_recommendation": str(label_encoder.inverse_transform([idx[0]])[0]),
        "confidence": float(proba[idx[0]]),
        "alternatives": [
            {"crop": str(label_encoder.inverse_transform([i])[0]), "confidence": float(proba[i])} 
            for i in idx[1:4]
        ],
        "mode": "ml-xgb"
    }
