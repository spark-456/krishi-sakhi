import logging
import base64
import io
import asyncio
from gtts import gTTS

logger = logging.getLogger(__name__)

async def generate_speech(text: str) -> dict:
    """Uses Google Text-to-Speech (gTTS) to generate Base64 audio from text."""
    if not text:
        return {"audio_b64": "", "provider": "none"}
        
    text = text[:5000] # gTTS limit
    print(f"[gTTS] Generating speech for text: {text[:50]}...")

    def create_tts(t: str) -> str:
        try:
            # We set tld='co.in' for Indian accent English or native language handling
            tts = gTTS(text=t, lang='en', tld='co.in', slow=False)
            fp = io.BytesIO()
            tts.write_to_fp(fp)
            fp.seek(0)
            return base64.b64encode(fp.read()).decode("utf-8")
        except Exception as e:
            logger.error(f"gTTS library error: {str(e)}")
            return ""

    try:
        # Wrap the blocking TTS in an 45-second timeout
        b64_audio = await asyncio.wait_for(asyncio.to_thread(create_tts, text), timeout=45.0)
    except asyncio.TimeoutError:
        logger.error("gTTS library error: Timeout after 45s")
        return {"audio_b64": "", "provider": "none"}
        
    if b64_audio:
        print(f"[gTTS] Success! Payload size: {len(b64_audio)} chars")
        return {"audio_b64": b64_audio, "provider": "gtts"}
    else:
        print("[gTTS] Failed to generate audio payload")
        return {"audio_b64": "", "provider": "none"}
