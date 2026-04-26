import os
import sys
import asyncio
import httpx
from supabase import create_client

sys.path.append(os.path.join(os.getcwd(), "backend"))
from config import settings

SUPABASE_URL = settings.supabase_url
SUPABASE_KEY = settings.supabase_anon_key

async def run_stress_test():
    print("=== STARTING STRESS TEST ===")
    
    # 1. Login to Supabase
    print("1. Logging into Supabase as demo user...")
    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    res = db.auth.sign_in_with_password({
        "email": "demo@krishisakhi.dev",
        "password": "KrishiDemo123!"
    })
    
    token = res.session.access_token
    farmer_id = res.user.id
    print(f"   Success! Got JWT.")
    
    # 2. Setup HTTPX client
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # 3. Test Advisory ask
    print("\n2. Testing /api/v1/advisory/ask with complex prompts...")
    
    prompts = [
        "Hello, what is my name and where is my farm located based on your knowledge?",
        "What crops am I currently growing? Tell me the stage they are at.",
        "What diseases have been found on my crops?",
        "Are there any market trends for the crops I grow?",
        "Given the current weather and my expenses so far, what should I do next?"
    ]
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        session_id = None
        
        # Optionally create a session via the session endpoint if it exists
        # For now, let's just make the ask requests with a dummy session 
        # or the one the app uses. The app usually uses a UUID string.
        # Let's see if we can create a session:
        resp = await client.post("http://127.0.0.1:8080/api/v1/advisory/sessions", headers=headers)
        if resp.status_code == 200:
            session_id = resp.json().get("session_id")
            print(f"   Created Advisory Session: {session_id}")
        else:
            print(f"   Warning: Could not create session. Status {resp.status_code}. Using None.")
        
        for i, prompt in enumerate(prompts, 1):
            print(f"\n--- Question {i} ---")
            print(f"User: {prompt}")
            
            payload = {
                "farmer_id": farmer_id,
                "farmer_input_text": prompt,
                "input_channel": "web",
                "session_id": session_id,
            }
            
            try:
                resp = await client.post("http://127.0.0.1:8080/api/v1/advisory/ask", json=payload, headers=headers)
                
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"AI: {data.get('response_text', '').strip()}")
                else:
                    print(f"❌ ERROR {resp.status_code} on Question {i}: {resp.text}")
                    
            except Exception as e:
                print(f"❌ CRITICAL ERROR on Question {i}: {str(e)}")

        print("\n=== STRESS TEST COMPLETE ===")

if __name__ == "__main__":
    asyncio.run(run_stress_test())