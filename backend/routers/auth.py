from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from supabase import Client
from dependencies import get_supabase_service

router = APIRouter(tags=["Auth"])

class RegisterRequest(BaseModel):
    phone: str
    password: str

@router.post("/register")
async def register_user(req: RegisterRequest, db: Client = Depends(get_supabase_service)):
    email = f"{req.phone}@ks.com"
    try:
        # Create an auto-confirmed user bypassing all email limits
        user = db.auth.admin.create_user({
            "email": email,
            "password": req.password,
            "email_confirm": True
        })
        return {"status": "success", "user_id": user.user.id}
    except Exception as e:
        error_msg = str(e)
        if "already exists" in error_msg.lower():
            return {"status": "success", "message": "User already exists"}
        raise HTTPException(status_code=400, detail=error_msg)
