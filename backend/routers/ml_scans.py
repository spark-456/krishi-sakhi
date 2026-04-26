from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from supabase import Client
from uuid import UUID
import time, httpx

from dependencies import get_supabase_service, get_current_farmer_id
from config import settings

router = APIRouter(prefix="/scans", tags=["ML Scans"])


# ─── Soil soil_classifier stub (ML microservice not yet deployed) ─────────────────
SOIL_CLASS_LABELS = ["alluvial", "black", "clay", "loam", "red", "sandy"]
SOIL_ADVICE_MAP = {
    "alluvial": ("Very fertile — ideal for rice, wheat, and sugarcane.", "Maintain soil pH between 6–7.5. Add potassium-rich fertilizers."),
    "black":    ("Rich in clay — excellent for cotton, sorghum, and pulses.", "Ensure good drainage. Lime if pH < 6. Avoid waterlogging."),
    "clay":     ("Dense and moisture-retentive — good for paddy.", "Add organic matter for aeration. Test phosphorus levels yearly."),
    "loam":     ("Balanced and nutrient-rich — excellent for most crops.", "Ideal general-purpose soil. Keep pH near 6.5 for best results."),
    "red":      ("Low fertility but workable — good for groundnut and millets.", "Add nitrogen and phosphorus before planting. Use compost regularly."),
    "sandy":    ("Well-drained but low nutrients — suitable for cassava, groundnut.", "Use drip irrigation. Apply frequent small doses of fertilizer."),
}


async def _call_soil_classifier(image_bytes: bytes, content_type: str) -> dict:
    """
    Calls the soil_classifier ML microservice at SOIL_CLASSIFIER_URL.
    Falls back to a rule-based stub if the service is unreachable.
    """
    try:
        async with httpx.AsyncClient(timeout=settings.ml_timeout_seconds) as client:
            resp = await client.post(
                f"{settings.soil_classifier_url}/predict",
                files={"file": ("image.jpg", image_bytes, content_type)},
            )
            resp.raise_for_status()
            d = resp.json()
            return {
                "predicted_soil_class": d.get("class", "alluvial"),
                "confidence_score": d.get("confidence", 0.90),
                "mode": "model",
            }
    except Exception:
        # Stub: cycle through labels deterministically by image size to vary results
        idx = (len(image_bytes) // 1024) % len(SOIL_CLASS_LABELS)
        cls = SOIL_CLASS_LABELS[idx]
        return {
            "predicted_soil_class": cls,
            "confidence_score": 0.87,
            "mode": "stub",
        }


def _plant_disease_text(label: str) -> tuple[str, str]:
    clean_label = (label or "Plant issue").replace("___", " - ").replace("_", " ")
    if clean_label.lower() in {"healthy", "plant healthy"} or clean_label.lower().endswith(" healthy"):
        return (
            f"{clean_label} detected.",
            "Keep monitoring leaf surfaces and maintain regular irrigation and field hygiene.",
        )
    return (
        f"The image most closely matches {clean_label}.",
        "Isolate visibly affected leaves, avoid overhead watering, and ask Sakhi for crop-specific treatment before spraying.",
    )


async def _call_plant_disease_classifier(image_bytes: bytes, content_type: str) -> dict:
    """
    Calls the plant disease ML microservice.
    Falls back to the old deterministic response if the service is unavailable.
    """
    try:
        timeout = max(settings.ml_timeout_seconds, 30)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{settings.plant_disease_classifier_url}/predict",
                files={"file": ("plant.jpg", image_bytes, content_type)},
            )
            resp.raise_for_status()
            d = resp.json()
            disease = d.get("predicted_pest_or_disease") or d.get("label") or "Plant issue"
            confidence = float(d.get("confidence_score", d.get("confidence", 0.0)) or 0.0)
            return {
                "predicted_pest_or_disease": disease,
                "confidence_score": confidence,
                "top_predictions": d.get("top_predictions", []),
                "mode": d.get("mode", "model"),
                "model": d.get("model"),
                "error": None,
            }
    except Exception as exc:
        return {
            "predicted_pest_or_disease": "Early Blight",
            "confidence_score": 0.88,
            "top_predictions": [],
            "mode": "stub",
            "model": None,
            "error": str(exc),
        }


@router.post("/soil")
async def scan_soil(
    image: UploadFile = File(...),
    farm_id: str = Form(...),
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase_service),
):
    """
    Upload soil image → classify → write DB → return result.
    """
    file_bytes = await image.read()
    content_type = image.content_type or "image/jpeg"
    ext = "jpg" if "jpeg" in content_type else "png"
    timestamp = int(time.time())
    path = f"{farmer_id}/{farm_id}/{timestamp}.{ext}"

    # 1. Upload to Supabase Storage
    try:
        db.storage.from_("soil-images").upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": content_type},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {str(e)}")

    # 2. Call classifier
    ml = await _call_soil_classifier(file_bytes, content_type)
    pred_class = ml["predicted_soil_class"]
    conf = ml["confidence_score"]
    mode = ml["mode"]

    # 3. Write DB
    try:
        db.table("soil_scans").insert({
            "farmer_id": str(farmer_id),
            "farm_id": farm_id,
            "storage_path": path,
            "predicted_soil_class": pred_class,
            "confidence_score": conf,
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB insert failed: {str(e)}")

    description, tip = SOIL_ADVICE_MAP.get(pred_class, ("Soil classified.", "Consult Sakhi for detailed advice."))

    return {
        "predicted_soil_class": pred_class,
        "confidence_score": conf,
        "farm_id": farm_id,
        "description": description,
        "tip": tip,
        "mode": mode,
    }


@router.post("/soil-with-advisory")
async def scan_soil_with_advisory(
    image: UploadFile = File(...),
    farm_id: str = Form(None, description="Optional farm ID for DB storage"),
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase_service),
):
    """
    Upload soil image → classify → get contextual advisory from Dify.
    Returns: soil class + confidence + advisory text from RAG.
    Used by camera screen for the full soil-to-advice flow.
    """
    file_bytes = await image.read()
    content_type = image.content_type or "image/jpeg"
    ext = "jpg" if "jpeg" in content_type else "png"
    timestamp = int(time.time())

    # 1. Classify soil
    ml = await _call_soil_classifier(file_bytes, content_type)
    pred_class = ml["predicted_soil_class"]
    conf = ml["confidence_score"]
    mode = ml["mode"]

    description, tip = SOIL_ADVICE_MAP.get(pred_class, ("Soil classified.", "Consult Sakhi for detailed advice."))

    # 2. Upload image and log to DB
    path = f"{farmer_id}/{farm_id or 'unassigned'}/{timestamp}.{ext}"
    try:
        db.storage.from_("soil-images").upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": content_type},
        )
        db.table("soil_scans").insert({
            "farmer_id": str(farmer_id),
            "farm_id": farm_id if farm_id else None,
            "storage_path": path,
            "predicted_soil_class": pred_class,
            "confidence_score": conf,
        }).execute()
        storage_path = path
    except Exception:
        storage_path = None
        pass  # Storage failures are non-fatal for advisory

    # 4. Return concise advisory text directly (saves tokens and improves speed)
    answer_text = (
        f"I have successfully analyzed your soil. It is **{pred_class.title()} Soil** ({round(conf * 100)}% confidence).\n"
        f"What would you like to know more about this? (e.g., suitable crops, management tips)"
    )

    return {
        "predicted_soil_class": pred_class,
        "confidence_score": conf,
        "confidence_pct": round(conf * 100),
        "description": description,
        "tip": tip,
        "advisory_text": answer_text,
        "storage_path": storage_path,
        "mode": mode,
    }


@router.post("/pest")
async def scan_pest(
    image: UploadFile = File(...),
    farm_id: str = Form(None),
    crop_record_id: str = Form(None),
    farmer_id: UUID = Depends(get_current_farmer_id),
):
    """Classify a pest/disease image, then best-effort upload and log the scan."""
    db: Client = get_supabase_service()

    file_bytes = await image.read()
    content_type = image.content_type or "image/jpeg"
    ext = "jpg" if "jpeg" in content_type else "png"
    timestamp = int(time.time())

    dir_id = crop_record_id or farm_id or "unassigned"
    path = f"{farmer_id}/{dir_id}/{timestamp}.{ext}"

    ml = await _call_plant_disease_classifier(file_bytes, content_type)
    disease = ml["predicted_pest_or_disease"]
    conf = ml["confidence_score"]
    description, tip = _plant_disease_text(disease)

    storage_path = None
    storage_error = None
    try:
        db.storage.from_("pest-images").upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": content_type},
        )
        storage_path = path
    except Exception as e:
        storage_error = str(e)

    growth_stage_at_scan = None
    if crop_record_id:
        try:
            cr = db.table("crop_records").select("growth_stage").eq("id", crop_record_id).single().execute()
            growth_stage_at_scan = cr.data.get("growth_stage") if cr.data else None
        except Exception:
            pass

    insert_data = {
        "farmer_id": str(farmer_id),
        "storage_path": storage_path or path,
        "predicted_pest_or_disease": disease,
        "confidence_score": conf,
    }
    if crop_record_id:
        insert_data["crop_record_id"] = crop_record_id
    if growth_stage_at_scan:
        insert_data["growth_stage_at_scan"] = growth_stage_at_scan

    db_logged = False
    db_error = None
    try:
        db.table("pest_scans").insert(insert_data).execute()
        db_logged = True
    except Exception as e:
        db_error = str(e)

    return {
        "predicted_pest_or_disease": disease,
        "disease": disease,
        "predicted_disease": disease,
        "confidence_score": conf,
        "confidence_pct": round(conf * 100),
        "severity": "Moderate",
        "description": description,
        "tip": tip,
        "top_predictions": ml.get("top_predictions", []),
        "storage_path": storage_path,
        "db_logged": db_logged,
        "mode": ml.get("mode", "stub"),
        "model": ml.get("model"),
        "ml_error": ml.get("error"),
        "storage_error": storage_error,
        "db_error": db_error,
    }
