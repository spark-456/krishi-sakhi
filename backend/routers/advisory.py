from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from supabase import Client
from uuid import UUID, uuid4

from dependencies import get_supabase, get_current_farmer_id
from models.advisory import AdvisoryAskRequest, AdvisoryAskResponse
from services.context_assembler import assemble_context
from services.dify_client import ask_dify
from services.audit_writer import write_audit_log
from services.stt_service import transcribe_audio
from services.tts_service import generate_speech

router = APIRouter(prefix="/advisory", tags=["Advisory"])

@router.post("/sessions")
async def create_session(
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    try:
        result = db.table("advisory_sessions").insert({
            "farmer_id": str(farmer_id)
        }).execute()
        session_id = result.data[0]["id"] if result.data else str(uuid4())
    except Exception:
        # Fallback: generate a client-side UUID if DB insert fails
        session_id = str(uuid4())
    return {"session_id": session_id}

@router.patch("/sessions/{session_id}")
async def end_session(
    session_id: UUID,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    try:
        db.table("advisory_sessions").update({"ended_at": "now()"}).eq("id", str(session_id)).execute()
    except Exception:
        pass
    return {"status": "ended", "session_id": session_id}

@router.post("/ask", response_model=AdvisoryAskResponse)
async def ask_advisory(
    request: AdvisoryAskRequest,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    # 1. Assemble Context
    context = await assemble_context(
        farmer_id, 
        request.farm_id, 
        request.crop_record_id, 
        db, 
        query=request.farmer_input_text,
        session_id=request.session_id
    )

    # 2. Ask Dify
    dify_resp = await ask_dify(request.farmer_input_text, context)
    import re
    answer_text = re.sub(r'[\*\#]', '', dify_resp.get("answer", ""))

    # 3. Synthesize Speech
    audio_b64 = ""
    if answer_text:
        tts_result = await generate_speech(answer_text)
        audio_b64 = tts_result.get("audio_b64", "")

    # 4. Write Audit Log
    await write_audit_log(request.session_id, request.farmer_input_text, dify_resp, context)

    return AdvisoryAskResponse(
        response_text=answer_text,
        was_deferred_to_kvk=dify_resp.get("was_deferred_to_kvk", False),
        latency_ms=100,
        session_id=request.session_id,
        message_id=str(uuid4()),
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

    # 1. Transcribe (STT)
    stt_result = await transcribe_audio(audio)
    transcription = stt_result.get("text", "")
    if not transcription:
        error_msg = stt_result.get("error", "Sorry, audio transcription is unavailable. Please type your question.")
        return {"transcription": "", "answer": error_msg, "audio_response_b64": ""}

    # 2. Assemble Context & Call Dify
    context = await assemble_context(farmer_uuid, None, None, db, query=transcription)
    dify_response = await ask_dify(transcription, context)

    import re
    answer_text = re.sub(r'[\*\#]', '', dify_response.get("answer", ""))

    # 3. Synthesize Speech (TTS)
    audio_b64 = ""
    if answer_text:
        tts_result = await generate_speech(answer_text)
        audio_b64 = tts_result.get("audio_b64", "")

    return {
        "transcription": transcription,
        "answer": answer_text,
        "audio_response_b64": audio_b64,
        "conversation_id": dify_response.get("conversation_id"),
        "was_deferred_to_kvk": dify_response.get("was_deferred_to_kvk", False)
    }
