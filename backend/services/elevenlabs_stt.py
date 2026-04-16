from fastapi import UploadFile, HTTPException
import logging
from config import settings
from groq import AsyncGroq
import os

logger = logging.getLogger(__name__)

async def transcribe_audio(audio_file: UploadFile) -> str:
    """Uses Groq whisper-large-v3-turbo directly for fast & reliable STT."""
    if not settings.groq_api_key:
        logger.warning("Groq API key missing, returning empty transcription.")  
        return ""
    client = AsyncGroq(api_key=settings.groq_api_key)

    try:
        file_bytes = await audio_file.read()
        
        # Groq needs a valid extension like .webm, .wav, or .mp3
        # Fast API upload passes typical web recordings as audio.webm or blob.webm
        filename = audio_file.filename if audio_file.filename and '.' in audio_file.filename else "recording.webm"
        
        transcription = await client.audio.transcriptions.create(
            file=(filename, file_bytes),
            model="whisper-large-v3-turbo",
            response_format="text"
        )
        
        transcript = transcription.text.strip() if hasattr(transcription, 'text') else str(transcription).strip()
        if not transcript:
             logger.warning("Groq STT returned an empty transcript.")
        return transcript
    except Exception as e:
        logger.error(f"Groq STT error: {str(e)}")
        # Provide graceful fallback
        return ""
