import asyncio
from supabase import Client
from uuid import UUID
from services.weather_client import get_weather_for_district

async def assemble_context(farmer_id: UUID | str, farm_id: str | None, crop_record_id: str | None, db: Client) -> dict:
    """
    Gathers data from DB and Weather in parallel using asyncio threads for sync clients.
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

    def get_activities():
        if farm_id:
            res = db.table("activity_logs").select("*").eq("farm_id", str(farm_id)).order("date", desc=True).limit(20).execute()
        else:
            res = db.table("activity_logs").select("*").eq("farmer_id", str(farmer_id)).order("date", desc=True).limit(20).execute()
        return res.data

    farmer_task = asyncio.to_thread(get_farmer)
    farms_task = asyncio.to_thread(get_farms)
    crops_task = asyncio.to_thread(get_crops)
    expenses_task = asyncio.to_thread(get_expenses)
    activities_task = asyncio.to_thread(get_activities)

    farmer, farms, crops, expenses, activities = await asyncio.gather(
        farmer_task, farms_task, crops_task, expenses_task, activities_task
    )

    district = farmer.get("district")
    weather = await get_weather_for_district(district, db) if district else {}  

    return {
        "farmer": farmer,
        "farms": farms,
        "crops": crops,
        "expenses": expenses,
        "activities": activities,
        "weather": weather
    }
