from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime, date
from uuid import UUID

class CropRecordBase(BaseModel):
    crop_name: str
    season: str
    sowing_date: Optional[date] = None
    expected_harvest_date: Optional[date] = None
    actual_harvest_date: Optional[date] = None
    growth_stage: Optional[str] = None
    status: Optional[str] = "active"

class CropRecordCreate(CropRecordBase):
    farm_id: UUID

class CropRecordUpdate(BaseModel):
    crop_name: Optional[str] = None
    season: Optional[str] = None
    sowing_date: Optional[date] = None
    expected_harvest_date: Optional[date] = None
    actual_harvest_date: Optional[date] = None
    growth_stage: Optional[str] = None
    status: Optional[str] = None

class CropRecordStatusUpdate(BaseModel):
    status: str

class CropRecordResponse(CropRecordBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    farm_id: UUID
    farmer_id: UUID
    created_at: datetime
    updated_at: datetime
