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
from services.agent_actions import plan_and_execute_agent_actions
from config import settings

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
    turn = await _run_advisory_turn(
        farmer_id=farmer_id,
        farmer_input_text=request.farmer_input_text,
        session_id=request.session_id,
        farm_id=request.farm_id,
        crop_record_id=request.crop_record_id,
        db=db,
    )

    return AdvisoryAskResponse(
        response_text=turn["response_text"],
        was_deferred_to_kvk=turn["was_deferred_to_kvk"],
        latency_ms=100,
        session_id=request.session_id,
        message_id=str(uuid4()),
        conversation_id=turn["conversation_id"],
        audio_b64=turn["audio_b64"],
        executed_actions=turn["executed_actions"],
        refresh_targets=turn["refresh_targets"],
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

    turn = await _run_advisory_turn(
        farmer_id=farmer_uuid,
        farmer_input_text=transcription,
        session_id=conversation_id,
        farm_id=None,
        crop_record_id=None,
        db=db,
    )

    return {
        "transcription": transcription,
        "answer": turn["response_text"],
        "audio_response_b64": turn["audio_b64"],
        "conversation_id": turn["conversation_id"],
        "was_deferred_to_kvk": turn["was_deferred_to_kvk"],
        "executed_actions": turn["executed_actions"],
        "refresh_targets": turn["refresh_targets"],
    }


async def _run_advisory_turn(
    farmer_id: UUID,
    farmer_input_text: str,
    session_id: str | None,
    farm_id: str | None,
    crop_record_id: str | None,
    db: Client,
):
    context = await assemble_context(
        farmer_id,
        farm_id,
        crop_record_id,
        db,
        query=farmer_input_text,
        session_id=session_id,
    )

    action_result = await plan_and_execute_agent_actions(
        user_input=farmer_input_text,
        farmer_id=str(farmer_id),
        context=context,
        db=db,
    )

    refreshed_context = context
    if action_result["executed_actions"]:
        refreshed_context = await assemble_context(
            farmer_id,
            farm_id,
            crop_record_id,
            db,
            query=farmer_input_text,
            session_id=session_id,
        )

    dify_prompt = farmer_input_text
    follow_up = action_result.get("follow_up_message")
    if action_result["executed_actions"]:
        confirmations = " ".join(item["message"] for item in action_result["executed_actions"] if item.get("message"))
        dify_prompt = (
            f"I already completed these farmer account actions: {confirmations} "
            f"Please confirm them briefly and answer the farmer's remaining need, if any. Farmer message: {farmer_input_text}"
        )

    if follow_up:
        response_text = follow_up
        dify_resp = {
            "answer": follow_up,
            "was_deferred_to_kvk": False,
            "conversation_id": "agent-follow-up",
        }
    elif not settings.dify_api_url and action_result["executed_actions"]:
        response_text = " ".join(item["message"] for item in action_result["executed_actions"] if item.get("message"))
        dify_resp = {
            "answer": response_text,
            "was_deferred_to_kvk": False,
            "conversation_id": "agent-local-action",
        }
    else:
        dify_resp = await ask_dify(dify_prompt, refreshed_context)
        import re
        response_text = re.sub(r'[\*\#]', '', dify_resp.get("answer", ""))

    audio_b64 = ""
    if response_text:
        tts_result = await generate_speech(response_text)
        audio_b64 = tts_result.get("audio_b64", "")

    audit_payload = {
        **dify_resp,
        "executed_actions": action_result["executed_actions"],
        "refresh_targets": action_result["refresh_targets"],
    }
    await write_audit_log(session_id, farmer_input_text, audit_payload, refreshed_context)

    return {
        "response_text": response_text,
        "audio_b64": audio_b64,
        "conversation_id": dify_resp.get("conversation_id", "fallback"),
        "was_deferred_to_kvk": dify_resp.get("was_deferred_to_kvk", False),
        "executed_actions": action_result["executed_actions"],
        "refresh_targets": action_result["refresh_targets"],
    }
