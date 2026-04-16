import logging
import base64
import io
import asyncio
from gtts import gTTS

logger = logging.getLogger(__name__)

async def generate_speech(text: str) -> str:
    """Uses Google Text-to-Speech (gTTS) to generate Base64 audio from text."""
    if not text:
        return ""
        
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

    b64_audio = await asyncio.to_thread(create_tts, text)
    if b64_audio:
        print(f"[gTTS] Success! Payload size: {len(b64_audio)} chars")
    else:
        print("[gTTS] Failed to generate audio payload")
        
    return b64_audio
