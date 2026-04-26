from fastapi import APIRouter, Depends, Query
from supabase import Client
from uuid import UUID
import httpx
import logging

from dependencies import get_supabase_service, get_current_farmer_id
from routers.weather import get_weather_for_district
from config import settings
from services.price_forecast_fallback import forecast_from_local_price_csv, normalize_price_forecast_units

router = APIRouter(prefix="/ml-insights", tags=["ML Insights"])
logger = logging.getLogger(__name__)

CROP_RECOMMENDER_URL = settings.crop_recommender_url
PRICE_FORECASTER_URL = settings.price_forecaster_url
TIMEOUT = 5.0

@router.get("/crop-recommendation")
async def get_crop_recommendation(
    farm_id: str = Query(None),
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase_service)
):
    try:
        farmer = db.table("farmers").select("district").eq("id", str(farmer_id)).single().execute()
        district = farmer.data.get("district", "Warangal") if farmer.data else "Warangal"
        
        w = await get_weather_for_district(district, db)
        temp = w.get("temp", 28.5) if w.get("temp") is not None else 28.5
        hum = w.get("humidity", 65.0) if w.get("humidity") is not None else 65.0
        rain = w.get("rainfall", 2.0) if w.get("rainfall") is not None else 2.0
        
        payload = {
            "location": district,
            "rainfall": float(rain) * 30 + 500, # Approximate scaling for seasonal expectation
            "monsoon_rainfall": 500.0,
            "temperature": float(temp),
            "humidity": float(hum),
            "wind_speed": 10.0,
            "yield_est": 4.5
        }
        
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(f"{CROP_RECOMMENDER_URL}/recommend", json=payload)
            resp.raise_for_status()
            data = resp.json()
            
        try:
            if not farm_id:
                raise ValueError("Skipping crop recommendation audit write because farm_id is required by schema")

            db.table("crop_recommendation_requests").insert({
                "farmer_id": str(farmer_id),
                "farm_id": farm_id,
                "input_temperature": payload["temperature"],
                "input_humidity": payload["humidity"],
                "input_rainfall": payload["rainfall"],
                "top_recommendation": data.get("top_recommendation"),
                "recommendation_scores": data.get("alternatives", [])
            }).execute()
        except Exception as db_e:
            logger.error(f"Failed to write crop rec to DB: {db_e}")
            
        return data
        
    except httpx.RequestError as e:
        logger.error(f"Crop recommender microservice unreachable: {e}")
        return {
            "top_recommendation": "Cotton",
            "confidence": 0.85,
            "alternatives": [{"crop": "Maize", "confidence": 0.4}],
            "mode": "stub",
            "error": "Service unavailable"
        }
    except Exception as e:
        logger.error(f"Unexpected crop rec error: {e}")
        return {
            "top_recommendation": "Paddy",
            "confidence": 0.82,
            "alternatives": [],
            "mode": "stub"
        }

@router.get("/price-forecast")
async def get_price_forecast(
    crop: str = Query(...),
    horizon: int = Query(7),
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase_service)
):
    try:
        farmer = db.table("farmers").select("district").eq("id", str(farmer_id)).single().execute()
        district = farmer.data.get("district", "Warangal") if farmer.data else "Warangal"
        
        payload = {
            "crop": crop,
            "district": district,
            "horizon": horizon
        }
        
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(f"{PRICE_FORECASTER_URL}/forecast", json=payload)
            resp.raise_for_status()
            data = normalize_price_forecast_units(resp.json())
            
        _write_price_forecast_audit(db, farmer_id, crop, district, horizon, data)
            
        return data
        
    except httpx.RequestError as e:
        logger.error(f"Price forecaster microservice unreachable: {e}")
        data = normalize_price_forecast_units(forecast_from_local_price_csv(crop, district, horizon))
        _write_price_forecast_audit(db, farmer_id, crop, district, horizon, data)
        return data
    except Exception as e:
        logger.error(f"Unexpected price forecast error: {e}")
        return {
            "directional_signal": "STABLE",
            "mode": "stub"
        }


def _write_price_forecast_audit(db: Client, farmer_id: UUID, crop: str, district: str, horizon: int, data: dict) -> None:
    try:
        db.table("price_forecast_requests").insert({
            "farmer_id": str(farmer_id),
            "crop_name": crop,
            "district": district,
            "directional_signal": data.get("directional_signal"),
            "forecast_mape": data.get("forecast_mape"),
            "forecast_horizon_days": horizon
        }).execute()
    except Exception as db_e:
        logger.error(f"Failed to write price forecast to DB: {db_e}")
