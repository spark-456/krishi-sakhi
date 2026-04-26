from pathlib import Path
from typing import Any
import io

import torch
from fastapi import FastAPI, File, UploadFile
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForImageClassification


app = FastAPI(title="Plant Disease Classifier API")

MODEL_ID = "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification"
LOCAL_MODEL_DIR = Path(__file__).resolve().parent / "model"

_processor = None
_model = None
_load_error = None


def _model_source() -> str:
    config_path = LOCAL_MODEL_DIR / "config.json"
    has_torch_weights = (LOCAL_MODEL_DIR / "pytorch_model.bin").exists()
    has_safe_weights = (LOCAL_MODEL_DIR / "model.safetensors").exists()
    if config_path.exists() and (has_torch_weights or has_safe_weights):
        return str(LOCAL_MODEL_DIR)
    return MODEL_ID


def _load_model() -> tuple[Any, Any]:
    global _processor, _model, _load_error
    if _processor is not None and _model is not None:
        return _processor, _model

    source = _model_source()
    try:
        _processor = AutoImageProcessor.from_pretrained(source, use_fast=False)
        _model = AutoModelForImageClassification.from_pretrained(source)
        _model.eval()
        _load_error = None
    except Exception as exc:
        _processor = None
        _model = None
        _load_error = str(exc)
        raise

    return _processor, _model


@app.get("/health")
def health():
    try:
        _load_model()
        return {
            "status": "ok",
            "mode": "hf-mobilenet",
            "model": MODEL_ID,
            "source": "local" if _model_source() == str(LOCAL_MODEL_DIR) else "huggingface",
            "classes": len(getattr(_model.config, "id2label", {}) or {}),
        }
    except Exception:
        return {
            "status": "warn",
            "mode": "unavailable",
            "model": MODEL_ID,
            "error": _load_error,
        }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    processor, model = _load_model()

    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")

    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1)[0]

    top_k = min(5, probs.shape[0])
    confidences, indices = torch.topk(probs, k=top_k)
    id2label = model.config.id2label

    top_predictions = []
    for confidence, idx in zip(confidences.tolist(), indices.tolist()):
        label = id2label.get(idx, str(idx))
        top_predictions.append({
            "label": label,
            "confidence": round(float(confidence), 4),
        })

    top = top_predictions[0]
    return {
        "predicted_pest_or_disease": top["label"],
        "confidence_score": top["confidence"],
        "top_predictions": top_predictions,
        "mode": "hf-mobilenet",
        "model": MODEL_ID,
    }
