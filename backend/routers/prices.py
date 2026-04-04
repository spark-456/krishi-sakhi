"""Price forecast router — ML stub with generic fallback."""
from fastapi import APIRouter

router = APIRouter()


@router.post("/prices/forecast")
async def forecast_prices():
    """Stub — Returns generic fallback until ML price_forecaster is deployed."""
    return {
        "crop_name": "unknown",
        "directional_signal": "STABLE",
        "forecast_mape": 0.0,
        "service_status": "stub",
        "message": "Price forecasting ML service not yet deployed. This is a placeholder response.",
    }
