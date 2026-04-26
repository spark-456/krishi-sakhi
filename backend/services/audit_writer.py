import asyncio
from uuid import UUID
from dependencies import get_supabase_service

async def write_audit_log(session_id: UUID, user_input: str, dify_resp: dict, context: dict):
    """
    Writes prompt, context, and completion to advisory_messages
    Must use Service Role Key to bypass RLS or execute safely
    """
    try:
        db = get_supabase_service()
        
        def insert_log():
            db.table("advisory_messages").insert({
                "session_id": str(session_id),
                "input_channel": "text", 
                "farmer_input_text": user_input,
                "response_text": dify_resp.get("answer", ""),
                "context_block_sent": context,
                "was_deferred_to_kvk": dify_resp.get("was_deferred_to_kvk", False),
            }).execute()

        await asyncio.to_thread(insert_log)
    except Exception as e:
        print(f"Failed to record audit log: {str(e)}")
