from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class YieldRecordBase(BaseModel):
    crop_record_id: UUID
    yield_kg: Optional[float] = None
    sale_price_per_kg: Optional[float] = None
    sale_date: Optional[date] = None
    buyer_type: Optional[str] = None
    notes: Optional[str] = None


class YieldRecordCreate(YieldRecordBase):
    pass


class YieldRecordUpdate(BaseModel):
    yield_kg: Optional[float] = None
    sale_price_per_kg: Optional[float] = None
    sale_date: Optional[date] = None
    buyer_type: Optional[str] = None
    notes: Optional[str] = None


class YieldRecordResponse(YieldRecordBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    farmer_id: UUID
    created_at: datetime
