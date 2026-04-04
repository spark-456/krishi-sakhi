from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client
from typing import List, Optional
from uuid import UUID

from dependencies import get_supabase, get_current_farmer_id
from models.activity import ActivityCreate, ActivityResponse

router = APIRouter(prefix="/activity", tags=["Farm Activity"])

@router.get("", response_model=List[ActivityResponse])
async def list_activities(
    farm_id: Optional[UUID] = None,
    limit: int = Query(50, le=100),
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    query = db.table("activity_logs").select("*").eq("farmer_id", str(farmer_id))
    
    if farm_id:
        query = query.eq("farm_id", str(farm_id))
        
    result = query.order("date", desc=True).limit(limit).execute()
    return result.data

@router.post("", response_model=ActivityResponse)
async def create_activity(
    activity: ActivityCreate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    data = activity.model_dump(exclude_unset=True)
    data["farmer_id"] = str(farmer_id)
    if "date" in data and data["date"]:
        data["date"] = data["date"].isoformat()
        
    result = db.table("activity_logs").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create activity log")
    return result.data[0]

@router.delete("/{activity_id}")
async def delete_activity(
    activity_id: UUID,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    result = db.table("activity_logs").delete().eq("id", str(activity_id)).eq("farmer_id", str(farmer_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Activity log not found or cannot be deleted")
    return {"status": "deleted", "id": activity_id}
