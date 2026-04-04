from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class AdvisoryAskRequest(BaseModel):
    session_id: UUID
    input_channel: str
    farmer_input_text: str
    farm_id: Optional[UUID] = None
    crop_record_id: Optional[UUID] = None

class AdvisoryAskResponse(BaseModel):
    response_text: str
    was_deferred_to_kvk: bool
    latency_ms: int
    session_id: UUID
    message_id: UUID
    conversation_id: str
