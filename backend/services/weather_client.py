import httpx
from config import settings

async def get_weather(district: str, lat: float = None, lon: float = None) -> dict:
    """Fetches current weather from Open-Meteo. Returns empty dict on failure."""
    try:
        # Use geocoding API if lat/lon not provided
        # For now, use hardcoded coordinates for common districts as fallback
        if not lat or not lon:
            return {"temp": None, "humidity": None, "rainfall": None, "forecast": "unavailable"}
        
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{settings.open_meteo_base_url}/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,precipitation",
                    "forecast_days": 1,
                }
            )
            resp.raise_for_status()
            data = resp.json()
            current = data.get("current", {})
            return {
                "temp": current.get("temperature_2m"),
                "humidity": current.get("relative_humidity_2m"),
                "rainfall": current.get("precipitation"),
                "forecast": "available",
            }
    except Exception:
        return {"temp": None, "humidity": None, "rainfall": None, "forecast": "unavailable"}

async def get_weather_for_district(district: str, db) -> dict:
    import asyncio
    def fetch_coords():
        return db.table("ref_locations").select("latitude, longitude").eq("district", district).limit(1).execute()
        
    result = await asyncio.to_thread(fetch_coords)
    
    if not result.data or not result.data[0].get("latitude"):
        return {"temp": None, "humidity": None, "rainfall": None, "forecast": "unavailable"}
    
    lat = result.data[0]["latitude"]
    lon = result.data[0]["longitude"]
    return await get_weather(district, lat, lon)
