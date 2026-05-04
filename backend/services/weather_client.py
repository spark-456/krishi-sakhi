import httpx

from config import settings

GEOCODING_BASE_URL = "https://geocoding-api.open-meteo.com/v1"


async def get_weather(district: str, lat: float = None, lon: float = None) -> dict:
    """Fetch current and near-term weather from Open-Meteo."""
    try:
        if lat is None or lon is None:
            return {"temp": None, "humidity": None, "rainfall": None, "forecast": "unavailable", "condition": "Unavailable"}

        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                f"{settings.open_meteo_base_url}/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code",
                    "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min",
                    "forecast_days": 1,
                    "timezone": "auto",
                }
            )
            resp.raise_for_status()
            data = resp.json()
            current = data.get("current", {})
            daily = data.get("daily", {})
            temp = current.get("temperature_2m")
            rain = current.get("precipitation")
            weather_code = current.get("weather_code")
            condition = _weather_code_to_condition(weather_code, temp=temp, rain=rain)

            max_temps = daily.get("temperature_2m_max") or [None]
            min_temps = daily.get("temperature_2m_min") or [None]
            daily_rain = daily.get("precipitation_sum") or [None]
            forecast_parts = []
            if max_temps[0] is not None and min_temps[0] is not None:
                forecast_parts.append(f"{round(min_temps[0])}°-{round(max_temps[0])}°")
            if daily_rain[0] is not None:
                forecast_parts.append(f"{daily_rain[0]} mm expected")

            return {
                "temp": temp,
                "humidity": current.get("relative_humidity_2m"),
                "rainfall": rain,
                "forecast": " • ".join(forecast_parts) if forecast_parts else "available",
                "condition": condition,
                "latitude": lat,
                "longitude": lon,
            }
    except Exception:
        return {"temp": None, "humidity": None, "rainfall": None, "forecast": "unavailable", "condition": "Unavailable"}


async def get_weather_for_district(
    district: str,
    db,
    *,
    state: str | None = None,
    fallback_lat: float | None = None,
    fallback_lon: float | None = None,
) -> dict:
    lat, lon = await _resolve_coordinates(district=district, state=state, db=db, fallback_lat=fallback_lat, fallback_lon=fallback_lon)
    return await get_weather(district, lat=lat, lon=lon)


async def _resolve_coordinates(district: str, state: str | None, db, fallback_lat: float | None, fallback_lon: float | None):
    if fallback_lat is not None and fallback_lon is not None:
        return fallback_lat, fallback_lon

    try:
        query = db.table("ref_locations").select("latitude, longitude").ilike("district", district).limit(1)
        if state:
            query = query.ilike("state", state)
        res = query.execute()
        if res.data:
            lat = res.data[0].get("latitude")
            lon = res.data[0].get("longitude")
            if lat is not None and lon is not None:
                return float(lat), float(lon)
    except Exception:
        pass

    async with httpx.AsyncClient(timeout=8) as client:
        query_name = f"{district}, {state}, India" if state else f"{district}, India"
        resp = await client.get(
            f"{GEOCODING_BASE_URL}/search",
            params={"name": query_name, "count": 1, "language": "en", "format": "json"},
        )
        resp.raise_for_status()
        results = resp.json().get("results") or []
        if not results:
            return None, None
        return results[0].get("latitude"), results[0].get("longitude")


def _weather_code_to_condition(weather_code, temp=None, rain=None):
    if rain is not None and rain > 0.5:
        return "Rainy"
    mapping = {
        0: "Clear",
        1: "Mostly clear",
        2: "Partly cloudy",
        3: "Cloudy",
        45: "Foggy",
        48: "Foggy",
        51: "Drizzle",
        53: "Drizzle",
        55: "Drizzle",
        61: "Rainy",
        63: "Rainy",
        65: "Heavy rain",
        71: "Snow",
        80: "Rain showers",
        81: "Rain showers",
        82: "Heavy showers",
        95: "Thunderstorm",
    }
    if weather_code in mapping:
        return mapping[weather_code]
    if temp is not None and temp >= 32:
        return "Hot"
    if temp is not None and temp >= 26:
        return "Sunny"
    return "Cloudy"
