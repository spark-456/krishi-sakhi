from fastapi import FastAPI, UploadFile, File
import io

try:
    import whisper
    import soundfile as sf
    import numpy as np
    model = whisper.load_model("base")  # 74M params
except ImportError:
    model = None

app = FastAPI(title="Transcriber — Phase 7 Full")

@app.get("/health")
def health():
    return {"status": "ok", "mode": "full" if model else "stub_fallback"}

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    
    if not model:
        return {"text": "STUB: " + audio.filename, "confidence": 1.0}
        
    audio_array, sample_rate = sf.read(io.BytesIO(audio_bytes))
    if audio_array.ndim > 1:
        audio_array = audio_array.mean(axis=1)
    audio_float = audio_array.astype(np.float32)
    
    result = model.transcribe(audio_float, language="en")
    
    return {
        "text": result["text"].strip(),
        "confidence": result.get("avg_logprob", 0.0),
    }
