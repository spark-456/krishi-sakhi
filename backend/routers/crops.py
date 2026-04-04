from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from typing import List, Optional
from uuid import UUID

from dependencies import get_supabase, get_current_farmer_id
from models.crop import CropRecordCreate, CropRecordUpdate, CropRecordStatusUpdate, CropRecordResponse

router = APIRouter(prefix="/crops", tags=["Crop Records"])

@router.get("", response_model=List[CropRecordResponse])
async def list_crops(
    farm_id: Optional[UUID] = None,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    query = db.table("crop_records").select("*").eq("farmer_id", str(farmer_id))
    if farm_id:
        query = query.eq("farm_id", str(farm_id))
        
    result = query.execute()
    return result.data

@router.post("", response_model=CropRecordResponse)
async def create_crop(
    crop: CropRecordCreate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    data = crop.model_dump(exclude_unset=True)
    data["farmer_id"] = str(farmer_id)
    
    # Handle dates from date objects to strings if needed
    for date_field in ['sowing_date', 'expected_harvest_date', 'actual_harvest_date']:
        if date_field in data and data[date_field]:
            data[date_field] = data[date_field].isoformat()
            
    result = db.table("crop_records").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create crop record")
    return result.data[0]

@router.patch("/{crop_id}", response_model=CropRecordResponse)
async def update_crop(
    crop_id: UUID,
    crop: CropRecordUpdate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    data = crop.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
        
    for date_field in ['sowing_date', 'expected_harvest_date', 'actual_harvest_date']:
        if date_field in data and data[date_field]:
            data[date_field] = data[date_field].isoformat()
            
    result = db.table("crop_records").update(data).eq("id", str(crop_id)).eq("farmer_id", str(farmer_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Crop record not found")
    return result.data[0]

@router.patch("/{crop_id}/status", response_model=CropRecordResponse)
async def update_crop_status(
    crop_id: UUID,
    status_update: CropRecordStatusUpdate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    result = db.table("crop_records").update({"status": status_update.status}).eq("id", str(crop_id)).eq("farmer_id", str(farmer_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Crop record not found")
    return result.data[0]
