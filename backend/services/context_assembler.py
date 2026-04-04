import asyncio
from supabase import Client
from uuid import UUID
from services.weather_client import get_weather_for_district

async def assemble_context(farmer_id: UUID, farm_id: UUID | None, crop_record_id: UUID | None, db: Client) -> dict:
    """
    Gathers data from DB and Weather in parallel using asyncio threads for sync clients.
    """
    def get_farmer():
        res = db.table("farmers").select("*").eq("id", str(farmer_id)).execute()
        return res.data[0] if res.data else {}

    def get_farm():
        if not farm_id: return {}
        res = db.table("farms").select("*").eq("id", str(farm_id)).execute()
        return res.data[0] if res.data else {}

    def get_crop():
        if not crop_record_id: return {}
        res = db.table("crop_records").select("*").eq("id", str(crop_record_id)).execute()
        return res.data[0] if res.data else {}

    def get_expenses():
        if not crop_record_id: return []
        res = db.table("expense_logs").select("*").eq("crop_record_id", str(crop_record_id)).execute()
        return res.data

    farmer_task = asyncio.to_thread(get_farmer)
    farm_task = asyncio.to_thread(get_farm)
    crop_task = asyncio.to_thread(get_crop)
    expenses_task = asyncio.to_thread(get_expenses)
    
    farmer, farm, crop, expenses = await asyncio.gather(
        farmer_task, farm_task, crop_task, expenses_task
    )
    
    district = farmer.get("district")
    weather = await get_weather_for_district(district, db) if district else {}

    return {
        "farmer": farmer,
        "farm": farm,
        "crop": crop,
        "expenses": expenses,
        "weather": weather
    }
