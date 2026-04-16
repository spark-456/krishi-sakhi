import httpx
from config import settings

async def ask_dify(farmer_input_text: str, context: dict) -> dict:
    """Calls Dify Chat API"""
    if not settings.dify_api_url or not settings.dify_api_key:
        return {
            "answer": "[DIFY_API_KEY NOT CONFIGURED] " + farmer_input_text,
            "was_deferred_to_kvk": False,
            "conversation_id": "placeholder-conv-id"
        }
        
    url = f"{settings.dify_api_url}/chat-messages"
    headers = {
        "Authorization": f"Bearer {settings.dify_api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "inputs": context,
        "query": farmer_input_text,
        "response_mode": "blocking",
        "user": str(context.get("farmer", {}).get("id", "anonymous"))
    }
    
    async with httpx.AsyncClient(timeout=settings.advisory_timeout_seconds) as client:
        try:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return {
                "answer": data.get("answer", ""),
                "was_deferred_to_kvk": "kvk" in data.get("answer", "").lower(),
                "conversation_id": data.get("conversation_id", "dynamic-conv-id")
            }
        except Exception as e:
            return {
                "answer": "Sorry, unable to connect to the servers. Thank you for your understanding",
                "was_deferred_to_kvk": False,
                "conversation_id": "error-conv-id"
            }
