"""Soil scan router — ML stub with generic fallback."""
from fastapi import APIRouter

router = APIRouter()


@router.post("/soil/scan")
async def scan_soil():
    """Stub — Returns generic fallback until ML soil_classifier is deployed."""
    return {
        "predicted_soil_class": "loam",
        "confidence_score": 0.0,
        "service_status": "stub",
        "message": "Soil classification ML service not yet deployed. This is a placeholder response.",
    }
