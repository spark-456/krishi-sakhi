from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from supabase import Client
from uuid import UUID

from dependencies import get_supabase, get_current_farmer_id
from models.advisory import AdvisoryAskRequest, AdvisoryAskResponse
from services.context_assembler import assemble_context
from services.dify_client import ask_dify
from services.audit_writer import write_audit_log
from services.elevenlabs_stt import transcribe_audio
from services.elevenlabs_tts import generate_speech

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
# 2. Ask Dify
    dify_resp = await ask_dify(request.farmer_input_text, context)
    answer_text = dify_resp.get("answer", "")

    # 3. Synthesize Speech
    audio_b64 = ""
    if answer_text:
        audio_b64 = await generate_speech(answer_text)

    # 4. Write Audit Log (Placeholder)
    await write_audit_log(request.session_id, request.farmer_input_text, dify_resp, context)

    return AdvisoryAskResponse(
        response_text=answer_text,
        was_deferred_to_kvk=dify_resp.get("was_deferred_to_kvk", False),        
        latency_ms=100,
        session_id=request.session_id,
        message_id="00000000-0000-0000-0000-000000000000",
        conversation_id=dify_resp.get("conversation_id", "fallback"),
        audio_b64=audio_b64
    )

@router.post("/voice-chat")
async def voice_chat_endpoint(
    audio: UploadFile = File(...),
    farmer_id: str = Form(...),
    conversation_id: str = Form(None),
    db: Client = Depends(get_supabase)
):
    try:
        farmer_uuid = UUID(farmer_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid farmer_id")
        
    # 1. Capture & Transcribe (STT)
    transcription = await transcribe_audio(audio)
    if not transcription:
         return {"transcription": "", "answer": "Sorry, the audio transcription service is under maintenance. Please try typing your question instead.", "audio_response_b64": ""}
    
    # 2. Process via Dify (Text processing)
    # Re-using context assembly
    context = await assemble_context(farmer_uuid, None, None, db)
    dify_response = await ask_dify(transcription, context)
    
    answer_text = dify_response.get("answer", "")
    
    # 3. Synthesize Speech (TTS)
    audio_b64 = ""
    if answer_text:
        audio_b64 = await generate_speech(answer_text)
        
    # 4. Return unified response
    return {
        "transcription": transcription,
        "answer": answer_text,
        "audio_response_b64": audio_b64,
        "conversation_id": dify_response.get("conversation_id"),
        "was_deferred_to_kvk": dify_response.get("was_deferred_to_kvk", False)
    }
