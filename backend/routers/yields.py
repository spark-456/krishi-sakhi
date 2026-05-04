from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from dependencies import get_current_farmer_id, get_supabase
from models.yield_record import YieldRecordCreate, YieldRecordResponse, YieldRecordUpdate

router = APIRouter(prefix="/yields", tags=["Yield Records"])


@router.get("", response_model=List[YieldRecordResponse])
async def list_yields(
    crop_record_id: Optional[UUID] = None,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    query = db.table("yield_records").select("*").eq("farmer_id", str(farmer_id))
    if crop_record_id:
        query = query.eq("crop_record_id", str(crop_record_id))
    result = query.order("sale_date", desc=True).execute()
    return result.data or []


@router.post("", response_model=YieldRecordResponse)
async def create_yield(
    payload: YieldRecordCreate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    crop_res = (
        db.table("crop_records")
        .select("id, farmer_id, status, actual_harvest_date")
        .eq("id", str(payload.crop_record_id))
        .eq("farmer_id", str(farmer_id))
        .single()
        .execute()
    )
    crop = crop_res.data
    if not crop:
        raise HTTPException(status_code=404, detail="Crop record not found")

    data = payload.model_dump(exclude_unset=True)
    data["farmer_id"] = str(farmer_id)
    for key in ("sale_date",):
        if data.get(key):
            data[key] = data[key].isoformat()

    existing = (
        db.table("yield_records")
        .select("*")
        .eq("crop_record_id", str(payload.crop_record_id))
        .eq("farmer_id", str(farmer_id))
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="Yield record already exists for this crop")

    result = db.table("yield_records").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create yield record")

    crop_update = {"status": "harvested"}
    if not crop.get("actual_harvest_date"):
        crop_update["actual_harvest_date"] = (
            payload.sale_date.isoformat() if isinstance(payload.sale_date, date) else date.today().isoformat()
        )
    db.table("crop_records").update(crop_update).eq("id", str(payload.crop_record_id)).eq("farmer_id", str(farmer_id)).execute()

    return result.data[0]


@router.patch("/{yield_id}", response_model=YieldRecordResponse)
async def update_yield(
    yield_id: UUID,
    payload: YieldRecordUpdate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    if data.get("sale_date"):
        data["sale_date"] = data["sale_date"].isoformat()

    result = (
        db.table("yield_records")
        .update(data)
        .eq("id", str(yield_id))
        .eq("farmer_id", str(farmer_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Yield record not found")
    return result.data[0]


@router.delete("/{yield_id}")
async def delete_yield(
    yield_id: UUID,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    result = (
        db.table("yield_records")
        .delete()
        .eq("id", str(yield_id))
        .eq("farmer_id", str(farmer_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Yield record not found")
    return {"status": "deleted", "id": str(yield_id)}
