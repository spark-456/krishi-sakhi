from fastapi import APIRouter, UploadFile, File, Form, Depends
from supabase import Client
from uuid import UUID

from dependencies import get_supabase, get_current_farmer_id

router = APIRouter(prefix="/scans", tags=["ML Scans"])

@router.post("/soil")
async def scan_soil(
    image: UploadFile = File(...),
    farm_id: str = Form(...),
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    """
    Placeholder: Upload image to Supabase, query ml/soil_classifier, update DB
    """
    return {
        "predicted_soil_class": "Placeholder",
        "confidence_score": 0.90,
        "farm_id": farm_id,
    }

@router.post("/pest")
async def scan_pest(
    image: UploadFile = File(...),
    farm_id: str = Form(...),
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    """
    Placeholder: Upload image to Supabase, query ml/pest_classifier
    """
    return {
        "disease": "Placeholder Disease",
        "confidence": "95%",
        "severity": "High",
        "treatment": "Placeholder Treatment Strategy"
    }
