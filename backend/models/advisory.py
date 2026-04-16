from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID

class AdvisoryAskRequest(BaseModel):
    session_id: Optional[str] = Field(default="00000000-0000-0000-0000-000000000000")
    input_channel: str
    farmer_input_text: str
    farm_id: Optional[str] = None
    crop_record_id: Optional[str] = None

class AdvisoryAskResponse(BaseModel):
    response_text: str
    was_deferred_to_kvk: bool
    latency_ms: int
    session_id: Optional[str] = "00000000-0000-0000-0000-000000000000"
    message_id: Optional[str] = "00000000-0000-0000-0000-000000000000"
    conversation_id: str
    audio_b64: Optional[str] = None
