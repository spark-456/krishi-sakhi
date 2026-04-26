import sys
import asyncio
sys.path.append("backend")

from config import settings
from services.dify_client import ask_dify
from services.stt_service import transcribe_audio

async def run_tests():
    # 1. Test Dify
    print("\n--- Testing Dify Connection ---")
    try:
        if settings.dify_api_key and settings.dify_api_url:
            resp = await ask_dify("What is the best crop to grow right now?", {"farmer": {"full_name": "Test Farmer"}})
            print("Dify Response:", resp.get("answer", "")[:100], "...")
            if resp.get("error"):
                print("Dify Error:", resp.get("error"))
        else:
            print("Dify NOT CONFIGURED")
    except Exception as e:
        print("Dify Error:", e)

    # 2. Test Groq
    print("\n--- Testing Groq (Text instead of audio to check auth) ---")
    if settings.groq_api_key:
        from groq import AsyncGroq
        try:
            client = AsyncGroq(api_key=settings.groq_api_key)
            # groq supports chat completion
            chat_completion = await client.chat.completions.create(
                messages=[{"role": "user", "content": "Say hello"}],
                model="llama-3.1-8b-instant",
            )
            print("Groq Connection Success:", chat_completion.choices[0].message.content)
        except Exception as e:
            print("Groq Connection Failed:", e)
    else:
        print("Groq API key not configured")

    # 3. Test ElevenLabs
    print("\n--- Testing ElevenLabs ---")
    if settings.elevenlabs_api_key:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                res = await client.get("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": settings.elevenlabs_api_key})
                if res.status_code == 200:
                    print("ElevenLabs Connection Success: Voices fetched ok.")
                else:
                    print(f"ElevenLabs Error: {res.status_code} - {res.text}")
        except Exception as e:
            print("ElevenLabs Error:", e)

if __name__ == "__main__":
    asyncio.run(run_tests())
