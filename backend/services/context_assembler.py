import asyncio
import httpx
from supabase import Client
from uuid import UUID
from config import settings
from services.weather_client import get_weather_for_district
from services.qdrant_client import search_knowledge_base
from services.price_forecast_fallback import forecast_from_local_price_csv, normalize_price_forecast_units
from dependencies import get_supabase_service

async def assemble_context(farmer_id: UUID | str, farm_id: str | None, crop_record_id: str | None, db: Client, query: str = "", session_id: str | None = None) -> dict:
    """
    Gathers data from DB, Weather, and Qdrant in parallel using asyncio threads for sync clients.
    If farm_id and crop_record_id are missing, it gathers ALL farms, ALL crop records, and ALL expenses for this farmer.
    """
    def get_farmer():
        res = db.table("farmers").select("*").eq("id", str(farmer_id)).execute()
        return res.data[0] if res.data else {}

    def get_farms():
        if farm_id:
            res = db.table("farms").select("*").eq("id", str(farm_id)).execute()
        else:
            res = db.table("farms").select("*").eq("farmer_id", str(farmer_id)).execute()
        return res.data

    def get_crops():
        if crop_record_id:
            res = db.table("crop_records").select("*").eq("id", str(crop_record_id)).execute()
        else:
            res = db.table("crop_records").select("*").eq("farmer_id", str(farmer_id)).execute()
        return res.data

    def get_expenses():
        if crop_record_id:
            res = db.table("expense_logs").select("*").eq("crop_record_id", str(crop_record_id)).execute()
        else:
            res = db.table("expense_logs").select("*").eq("farmer_id", str(farmer_id)).execute()
        return res.data

    def get_yields():
        if crop_record_id:
            res = db.table("yield_records").select("*").eq("crop_record_id", str(crop_record_id)).execute()
        else:
            res = db.table("yield_records").select("*").eq("farmer_id", str(farmer_id)).execute()
        return res.data

    def get_activities():
        if farm_id:
            res = db.table("activity_logs").select("*").eq("farm_id", str(farm_id)).order("date", desc=True).limit(20).execute()
        else:
            res = db.table("activity_logs").select("*").eq("farmer_id", str(farmer_id)).order("date", desc=True).limit(20).execute()
        return res.data

    def get_ml_insights():
        try:
            # Use service role to bypass RLS for intelligence gathering
            s_db = get_supabase_service()
            recs = s_db.table("crop_recommendation_requests").select("*").eq("farmer_id", str(farmer_id)).order("created_at", desc=True).limit(1).execute()
            prices = s_db.table("price_forecast_requests").select("*").eq("farmer_id", str(farmer_id)).order("generated_at", desc=True).limit(3).execute()
            return {
                "latest_crop_recommendation": recs.data[0] if recs.data else None,
                "recent_price_forecasts": prices.data if prices.data else []
            }
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"ContextAssembler ML Insight Err: {e}")
            return {"latest_crop_recommendation": None, "recent_price_forecasts": []}

    def get_soil_scans():
        try:
            if farm_id:
                res = db.table("soil_scans").select("*").eq("farm_id", str(farm_id)).order("created_at", desc=True).limit(3).execute()
            else:
                res = db.table("soil_scans").select("*").eq("farmer_id", str(farmer_id)).order("created_at", desc=True).limit(3).execute()
            return res.data
        except Exception:
            return []

    def get_chat_history():
        if not session_id:
            return []
        try:
            s_db = get_supabase_service()
            res = s_db.table("advisory_messages").select("farmer_input_text, response_text").eq("session_id", session_id).order("created_at", desc=True).limit(5).execute()
            # Reverse to Chronological
            return res.data[::-1] if res.data else []
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"ContextAssembler Chat History Err: {e}")
            return []

    farmer_task = asyncio.to_thread(get_farmer)
    farms_task = asyncio.to_thread(get_farms)
    crops_task = asyncio.to_thread(get_crops)
    expenses_task = asyncio.to_thread(get_expenses)
    yields_task = asyncio.to_thread(get_yields)
    activities_task = asyncio.to_thread(get_activities)
    ml_task = asyncio.to_thread(get_ml_insights)
    chat_task = asyncio.to_thread(get_chat_history)
    soil_scans_task = asyncio.to_thread(get_soil_scans)
    
    # search_knowledge_base is an async function
    if query:
        qdrant_task = asyncio.create_task(search_knowledge_base(query, top_k=3))
    else:
        async def empty_task(): return []
        qdrant_task = asyncio.create_task(empty_task())

    farmer, farms, crops, expenses, yields, activities, ml_insights, qdrant_docs, chat_history, soil_scans = await asyncio.gather(
        farmer_task, farms_task, crops_task, expenses_task, yields_task, activities_task, ml_task, qdrant_task, chat_task, soil_scans_task
    )

    district = farmer.get("district")
    primary_farm = next(
        (
            farm for farm in (farms or [])
            if farm.get("latitude") is not None and farm.get("longitude") is not None
        ),
        None,
    )
    weather = await get_weather_for_district(
        district,
        db,
        state=farmer.get("state"),
        fallback_lat=(primary_farm or {}).get("latitude"),
        fallback_lon=(primary_farm or {}).get("longitude"),
    ) if district else {}
    live_price_forecasts = await _get_live_price_forecasts_if_needed(query, district, crops, ml_insights)
    live_price_forecast = live_price_forecasts[0] if live_price_forecasts else None

    return {
        "farmer": farmer,
        "farms": farms,
        "crops": crops,
        "expenses": expenses,
        "yields": yields,
        "activities": activities,
        "weather": weather,
        "ml_insights": ml_insights,
        "live_price_forecast": live_price_forecast,
        "live_price_forecasts": live_price_forecasts,
        "knowledge_base": qdrant_docs,
        "chat_history": chat_history,
        "soil_scans": soil_scans
    }


async def _get_live_price_forecasts_if_needed(query: str, district: str | None, crops: list[dict], ml_insights: dict) -> list[dict]:
    if not query or not district:
        return []

    insight_terms = (
        "price", "market", "mandi", "sell", "selling", "rate", "forecast", "trend",
        "crop", "crops", "grow", "plant", "recommend", "recommended", "suggest", "top"
    )
    if not any(term in query.lower() for term in insight_terms):
        return []

    forecast_crops = _extract_recommended_crop_names(crops, ml_insights)
    if not forecast_crops:
        return []

    tasks = [_fetch_price_forecast(crop, district) for crop in forecast_crops[:4]]
    results = await asyncio.gather(*tasks)
    return [result for result in results if result]


def _extract_recommended_crop_names(crops: list[dict], ml_insights: dict) -> list[str]:
    latest_rec = ml_insights.get("latest_crop_recommendation") or {}
    names = []

    top_crop = latest_rec.get("top_recommendation")
    if top_crop:
        names.append(top_crop)

    scores = latest_rec.get("recommendation_scores") or []
    if isinstance(scores, list):
        for score in scores:
            if not isinstance(score, dict):
                continue
            crop_name = score.get("crop") or score.get("crop_name") or score.get("top_recommendation")
            if crop_name:
                names.append(crop_name)

    for crop in crops:
        if crop.get("status") == "active" and crop.get("crop_name"):
            names.append(crop["crop_name"])

    unique_names = []
    seen = set()
    for name in names:
        key = str(name).strip().lower()
        if key and key not in seen:
            seen.add(key)
            unique_names.append(str(name).strip())
    return unique_names


async def _fetch_price_forecast(crop: str, district: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=settings.ml_timeout_seconds) as client:
            resp = await client.post(
                f"{settings.price_forecaster_url}/forecast",
                json={"crop": crop, "district": district, "horizon": 7},
            )
            resp.raise_for_status()
            data = normalize_price_forecast_units(resp.json())
            data["crop"] = crop
            data["district"] = district
            return data
    except Exception:
        return normalize_price_forecast_units(forecast_from_local_price_csv(crop, district, 7))
