from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime, date
from uuid import UUID

class ExpenseBase(BaseModel):
    category: str
    amount_inr: float
    expense_date: date
    notes: Optional[str] = None
    crop_record_id: Optional[UUID] = None
    farm_id: Optional[UUID] = None

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseResponse(ExpenseBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    farmer_id: UUID
    created_at: datetime

class ExpenseSummary(BaseModel):
    category: str
    total_amount: float
