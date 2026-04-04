from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from typing import List
from uuid import UUID

from dependencies import get_supabase, get_current_farmer_id
from models.farm import FarmCreate, FarmUpdate, FarmResponse

router = APIRouter(prefix="/farms", tags=["Farms"])

@router.get("", response_model=List[FarmResponse])
async def list_farms(
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    result = db.table("farms").select("*").eq("farmer_id", str(farmer_id)).execute()
    return result.data

@router.post("", response_model=FarmResponse)
async def create_farm(
    farm: FarmCreate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    data = farm.model_dump(exclude_unset=True)
    data["farmer_id"] = str(farmer_id)
    result = db.table("farms").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create farm")
    return result.data[0]

@router.patch("/{farm_id}", response_model=FarmResponse)
async def update_farm(
    farm_id: UUID,
    farm: FarmUpdate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    data = farm.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
        
    result = db.table("farms").update(data).eq("id", str(farm_id)).eq("farmer_id", str(farmer_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Farm not found")
    return result.data[0]

@router.delete("/{farm_id}")
async def delete_farm(
    farm_id: UUID,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    result = db.table("farms").delete().eq("id", str(farm_id)).eq("farmer_id", str(farmer_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Farm not found or cannot be deleted")
    return {"status": "deleted", "id": farm_id}
