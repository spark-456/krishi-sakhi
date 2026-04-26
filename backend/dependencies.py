from fastapi import Header, HTTPException, Depends
from supabase import create_client, Client
from config import settings
from uuid import UUID

def get_supabase() -> Client:
    # Use Service Role Key by default for API-side data fetching to bypass RLS issues 
    # and ensure ContextAssembler always finds the farmer profile.
    return create_client(settings.supabase_url, settings.supabase_service_role_key)

def get_supabase_service() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)

async def get_current_farmer_id(
    authorization: str = Header(...),
    db: Client = Depends(get_supabase),
) -> UUID:
    token = authorization.removeprefix("Bearer ").strip()
    try:
        user = db.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return UUID(user.user.id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
