from fastapi import APIRouter, UploadFile, File, Form, Depends
from supabase import Client
from uuid import UUID
import time
from dependencies import get_supabase_service, get_current_farmer_id

router = APIRouter(prefix="/scans", tags=["ML Scans"])

@router.post("/soil")
async def scan_soil(
    image: UploadFile = File(...),
    farm_id: str = Form(...),
    farmer_id: UUID = Depends(get_current_farmer_id),
):
    """ Upload image to Supabase storage, write soil_scans table, return stub """ 
    db: Client = get_supabase_service()
    
    file_bytes = await image.read()
    content_type = image.content_type
    ext = "jpg" if "jpeg" in content_type else "png"
    timestamp = int(time.time())
    
    # Upload to Supabase Storage
    path = f"{farmer_id}/{farm_id}/{timestamp}.{ext}"
    res = db.storage.from_("soil-images").upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": content_type}
    )
    
    # Write to DB
    pred_class = "Alluvial"
    conf = 0.92
    
    db.table("soil_scans").insert({
        "farmer_id": str(farmer_id),
        "farm_id": farm_id,
        "image_path": path,
        "predicted_soil_class": pred_class,
        "confidence_score": conf,
    }).execute()

    return {
        "predicted_soil_class": pred_class,
        "confidence_score": conf,
        "farm_id": farm_id,
    }


@router.post("/pest")
async def scan_pest(
    image: UploadFile = File(...),
    farm_id: str = Form(None), # The UI sends farm_id or no id yet
    crop_record_id: str = Form(None),
    farmer_id: UUID = Depends(get_current_farmer_id)
):
    """ Upload image to Supabase storage, write pest_scans table, return stub """ 
    db: Client = get_supabase_service()

    file_bytes = await image.read()
    content_type = image.content_type
    ext = "jpg" if "jpeg" in content_type else "png"
    timestamp = int(time.time())
    
    # Use farm_id for pest bucket path fallback if crop_id is missing
    dir_id = crop_record_id or farm_id or "unknown"
    path = f"{farmer_id}/{dir_id}/{timestamp}.{ext}"
    
    res = db.storage.from_("pest-images").upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": content_type}
    )
    
    disease = "Early Blight"
    conf = 0.88
    
    insert_data = {
        "farmer_id": str(farmer_id),
        "image_path": path,
        "predicted_disease": disease,
        "confidence_score": conf,
        "treatment_recommendation": "Apply Mancozeb or similar fungicide."
    }
    
    if crop_record_id:
        insert_data["crop_record_id"] = crop_record_id

    db.table("pest_scans").insert(insert_data).execute()

    return {
        "disease": disease,
        "confidence": conf,
        "severity": "Moderate",
        "treatment": "Apply Mancozeb or similar fungicide."
    }
