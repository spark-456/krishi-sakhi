from fastapi import APIRouter, Depends
import logging

from dependencies import get_supabase, get_current_farmer_id
from services.weather_client import get_weather_for_district

router = APIRouter(prefix="/weather", tags=["Weather"])
logger = logging.getLogger(__name__)

@router.get("")
async def fetch_weather_for_farmer(db = Depends(get_supabase), farmer_id: str = Depends(get_current_farmer_id)):
    try:
        farmer_data = db.table("farmers").select("district, state").eq("id", str(farmer_id)).single().execute()
        if not farmer_data.data or not farmer_data.data.get("district"):
            return {
                "temp": 30,
                "condition": "Sunny",
                "humidity": 50,
                "forecast": "Unavailable",
                "source": "fallback",
                "location_label": "Weather unavailable",
            }

        district = farmer_data.data["district"]
        state = farmer_data.data.get("state")
        farm_res = db.table("farms").select("latitude, longitude").eq("farmer_id", str(farmer_id)).limit(5).execute()
        farm = next(
            (
                item for item in (farm_res.data or [])
                if item.get("latitude") is not None and item.get("longitude") is not None
            ),
            None,
        )
        lat = farm.get("latitude") if farm else None
        lon = farm.get("longitude") if farm else None

        w_data = await get_weather_for_district(district, db, state=state, fallback_lat=lat, fallback_lon=lon)
        temp = w_data.get("temp")
        hum = w_data.get("humidity")
        rain = w_data.get("rainfall")

        if temp is None:
            return {
                "temp": 32,
                "condition": "Sunny",
                "humidity": 65,
                "forecast": "Clear skies (Fallback)",
                "source": "fallback",
                "location_label": district,
            }

        cond = w_data.get("condition") or ("Rainy" if rain and rain > 0.5 else "Sunny" if temp > 28 else "Cloudy")
        return {
            "temp": round(temp),
            "condition": cond,
            "humidity": hum,
            "rainfall": rain,
            "forecast": w_data.get("forecast") or f"{district} - {cond}",
            "source": "open-meteo",
            "location_label": district,
            "latitude": w_data.get("latitude"),
            "longitude": w_data.get("longitude"),
        }
    except Exception as e:
        logger.error(f"[Weather API] Route Failed: {e}")
        return {
            "temp": 32,
            "condition": "Sunny",
            "humidity": 65,
            "forecast": "Clear skies expected (Fallback)",
            "source": "fallback",
            "location_label": "Weather unavailable",
        }
