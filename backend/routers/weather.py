from fastapi import APIRouter, Depends, HTTPException
import logging
import httpx
from typing import Optional

from dependencies import get_supabase, get_current_farmer_id
from config import settings

router = APIRouter(prefix="/weather", tags=["Weather"])
logger = logging.getLogger(__name__)

async def get_weather_for_district(district: str, db):
    try:
        res = db.table("ref_locations").select("latitude, longitude").eq("district", district).limit(1).execute()
        if not res.data: return {}
        lat, lon = res.data[0].get("latitude"), res.data[0].get("longitude")
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.open_meteo_base_url}/forecast", params={
                "latitude": lat, "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,precipitation",
            })
            if resp.status_code == 200:
                curr = resp.json().get("current", {})
                return {"temp": curr.get("temperature_2m"), "humidity": curr.get("relative_humidity_2m"), "rainfall": curr.get("precipitation")}
    except Exception as e:
        logger.error(f"[Weather API] Failed: {e}")
    return {}

@router.get("")
async def fetch_weather_for_farmer(db = Depends(get_supabase), farmer_id: str = Depends(get_current_farmer_id)):
    try:
        farmer_data = db.table("farmers").select("district").eq("id", str(farmer_id)).single().execute()
        if not farmer_data.data or not farmer_data.data.get("district"):
            return {"temp": 30, "condition": "Sunny", "humidity": 50, "forecast": "Unavailable"}
        
        district = farmer_data.data["district"]
        w_data = await get_weather_for_district(district, db)
        temp = w_data.get("temp")
        hum = w_data.get("humidity")
        rain = w_data.get("rainfall")
        
        if temp is None:
            return {"temp": 32, "condition": "Sunny", "humidity": 65, "forecast": "Clear skies (Fallback)"}
            
        cond = "Rainy" if rain and rain > 0.5 else "Sunny" if temp > 28 else "Cloudy"
        return {
            "temp": round(temp),
            "condition": cond,
            "humidity": hum,
            "forecast": f"{district} - {cond}"
        }
    except Exception as e:
        logger.error(f"[Weather API] Route Failed: {e}")
        return {"temp": 32, "condition": "Sunny", "humidity": 65, "forecast": "Clear skies expected (Fallback)"}
