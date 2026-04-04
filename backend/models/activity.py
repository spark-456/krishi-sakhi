from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime, date
from uuid import UUID

class ActivityBase(BaseModel):
    crop_name: Optional[str] = None
    activity_type: str
    title: str
    description: Optional[str] = None
    date: date
    farm_id: Optional[UUID] = None

class ActivityCreate(ActivityBase):
    pass

class ActivityResponse(ActivityBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    farmer_id: UUID
    created_at: datetime
