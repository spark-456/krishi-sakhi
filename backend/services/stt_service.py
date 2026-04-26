from fastapi import UploadFile, HTTPException
import logging
from config import settings
from groq import AsyncGroq
import os
import asyncio

logger = logging.getLogger(__name__)

async def transcribe_audio(audio_file: UploadFile) -> dict:
    """Uses Groq whisper-large-v3-turbo directly for fast & reliable STT."""
    if not settings.groq_api_key:
        logger.warning("Groq API key missing, returning structured error.")  
        return {"text": "", "provider": "none", "error": "Groq API key is missing. Please type your query."}

    client = AsyncGroq(api_key=settings.groq_api_key)

    try:
        file_bytes = await audio_file.read()
        
        filename = audio_file.filename if audio_file.filename and '.' in audio_file.filename else "recording.webm"
        
        # Adding content type `audio/webm` specifically satisfies Groq's validation layer for browser-recorded WebMs
        transcription_task = client.audio.transcriptions.create(
            file=(filename, file_bytes, audio_file.content_type or "audio/webm"),
            model="whisper-large-v3-turbo",
            response_format="text",
            language="en"
        )
        
        # 10 second timeout for STT
        transcription = await asyncio.wait_for(transcription_task, timeout=10.0)
        
        transcript = transcription.text.strip() if hasattr(transcription, 'text') else str(transcription).strip()
        if not transcript:
             logger.warning("Groq STT returned an empty transcript.")
             return {"text": "", "provider": "groq", "error": "Could not transcribe. Please try typing your question."}
             
        return {"text": transcript, "provider": "groq"}
    except asyncio.TimeoutError:
        logger.error("Groq STT error: Timeout after 10s")
        return {"text": "", "provider": "none", "error": "Transcription timed out. Please try typing your query."}
    except Exception as e:
        logger.error(f"Groq STT error: {str(e)}")
        # Provide graceful fallback
        return {"text": "", "provider": "none", "error": "Could not process audio. Please try typing your query."}
