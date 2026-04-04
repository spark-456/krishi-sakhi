from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client
from typing import List, Optional
from uuid import UUID
from datetime import date

from dependencies import get_supabase, get_current_farmer_id
from models.expense import ExpenseCreate, ExpenseResponse, ExpenseSummary

router = APIRouter(prefix="/expenses", tags=["Expenses"])

@router.get("", response_model=List[ExpenseResponse])
async def list_expenses(
    crop_record_id: Optional[UUID] = None,
    farm_id: Optional[UUID] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    query = db.table("expense_logs").select("*").eq("farmer_id", str(farmer_id))
    
    if crop_record_id:
        query = query.eq("crop_record_id", str(crop_record_id))
    if farm_id:
        query = query.eq("farm_id", str(farm_id))
    if from_date:
        query = query.gte("expense_date", from_date.isoformat())
    if to_date:
        query = query.lte("expense_date", to_date.isoformat())
        
    result = query.order("expense_date", desc=True).execute()
    return result.data

@router.post("", response_model=ExpenseResponse)
async def create_expense(
    expense: ExpenseCreate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    data = expense.model_dump(exclude_unset=True)
    data["farmer_id"] = str(farmer_id)
    if "expense_date" in data and data["expense_date"]:
        data["expense_date"] = data["expense_date"].isoformat()
        
    result = db.table("expense_logs").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create expense")
    return result.data[0]

@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: UUID,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase)
):
    result = db.table("expense_logs").delete().eq("id", str(expense_id)).eq("farmer_id", str(farmer_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Expense not found or cannot be deleted")
    return {"status": "deleted", "id": expense_id}
