from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from uuid import UUID

from dependencies import get_supabase, get_current_farmer_id
from models.advisory import AdvisoryAskRequest, AdvisoryAskResponse
from services.context_assembler import assemble_context
from services.dify_client import ask_dify
from services.audit_writer import write_audit_log

router = APIRouter(prefix="/advisory", tags=["Advisory"])

@router.post("/sessions")
async def create_session(
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    # Placeholder for creating a new session
    # result = db.table("advisory_sessions").insert({"farmer_id": str(farmer_id)}).execute()
    return {"session_id": "00000000-0000-0000-0000-000000000000"}

@router.patch("/sessions/{session_id}")
async def end_session(
    session_id: UUID,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    # Placeholder for ending a session
    # result = db.table("advisory_sessions").update({"ended_at": "now()"}).eq("id", str(session_id)).execute()
    return {"status": "ended", "session_id": session_id}

@router.post("/ask", response_model=AdvisoryAskResponse)
async def ask_advisory(
    request: AdvisoryAskRequest,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    # 1. Assemble context via asyncio.gather (Placeholder)
    context = await assemble_context(farmer_id, request.farm_id, request.crop_record_id, db)
    
    # 2. Ask Dify (Placeholder)
    dify_resp = await ask_dify(request.farmer_input_text, context)
    
    # 3. Write Audit Log (Placeholder)
    await write_audit_log(request.session_id, request.farmer_input_text, dify_resp, context)

    return AdvisoryAskResponse(
        response_text="[DIFY PLACEHOLDER RESPONSE]",
        was_deferred_to_kvk=False,
        latency_ms=100,
        session_id=request.session_id,
        message_id="00000000-0000-0000-0000-000000000000",
        conversation_id="dify-conv-placeholder"
    )
