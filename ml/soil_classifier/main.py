from fastapi import FastAPI, File, UploadFile, HTTPException
import random
import os

app = FastAPI(title="Soil Classifier API")

MODEL_PATH = "yolov8n-cls.pt"
is_stub = not os.path.exists(MODEL_PATH)
try:
    if not is_stub:
        from ultralytics import YOLO
        model = YOLO(MODEL_PATH)
    else:
        model = None
except ImportError:
    is_stub = True
    model = None

@app.get("/health")
def health():
    return {"status": "ok", "mode": "stub" if is_stub else "ml"}

@app.post("/predict")
async def classify_soil(file: UploadFile = File(...)):
    if is_stub:
        classes = ["alluvial", "black", "clay", "red"]
        return {
            "class": random.choice(classes),
            "confidence": round(random.uniform(0.85, 0.98), 3),
            "mode": "stub"
        }
    
    # ML inference path (architecture: YOLOv8n classification mode)
    # Assumes image processing and ultralytics inference here
    content = await file.read()
    with open("temp.jpg", "wb") as f:
        f.write(content)
        
    results = model("temp.jpg")
    top1_class_idx = results[0].probs.top1
    top1_conf = results[0].probs.top1conf.item()
    top1_name = results[0].names[top1_class_idx]
    os.remove("temp.jpg")
    
    formatted_name = top1_name.lower().replace(" soil", "").strip()
    
    return {
        "class": formatted_name,
        "confidence": round(top1_conf, 3),
        "mode": "ml"
    }
