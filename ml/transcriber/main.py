from fastapi import FastAPI, UploadFile, File, HTTPException
import os
import aiohttp
import json

app = FastAPI(title="Transcriber API using Groq Whisper")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

@app.get("/health")
def health():
    if not GROQ_API_KEY:
        return {"status": "warn", "message": "GROQ_API_KEY not set. Using stub mode.", "mode": "stub"}
    return {"status": "ok", "mode": "ml"}

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    
    if not GROQ_API_KEY:
        # Fallback if no key
        return {
            "text": f"Stub transcription for {audio.filename}",
            "confidence": 0.99,
            "mode": "stub"
        }
        
    try:
        import requests
        headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
        files = {
            "file": (audio.filename or "audio.webm", audio_bytes, audio.content_type or "audio/webm"),
            "model": (None, "whisper-large-v3-turbo")
        }
        response = requests.post("https://api.groq.com/openai/v1/audio/transcriptions", headers=headers, files=files, timeout=15)
        response.raise_for_status()
        
        data = response.json()
        
        return {
            "text": data.get("text", "").strip(),
            "confidence": 0.95,  # Groq API might not always return char word-level conf
            "mode": "ml"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
