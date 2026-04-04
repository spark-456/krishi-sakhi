from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

class FarmBase(BaseModel):
    farm_name: Optional[str] = None
    area_acres: Optional[float] = None
    soil_type: Optional[str] = None
    irrigation_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class FarmCreate(FarmBase):
    pass

class FarmUpdate(FarmBase):
    pass

class FarmResponse(FarmBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    farmer_id: UUID
    created_at: datetime
