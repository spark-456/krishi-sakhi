"""
Tickets router — farmer-side ticket creation and messaging.
"""
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from dependencies import get_supabase, get_current_farmer_id
from uuid import UUID
from typing import Optional
from pydantic import BaseModel
from services.notifications import create_notifications_for_admins

router = APIRouter(prefix="/tickets", tags=["Tickets"])


class TicketCreate(BaseModel):
    category: str
    priority: str = "medium"
    subject: str
    description: str


class TicketMessage(BaseModel):
    message: str


@router.get("")
async def list_my_tickets(
    status: Optional[str] = None,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    q = db.table("farmer_tickets").select(
        "id, category, priority, status, subject, created_at, updated_at, resolved_at"
    ).eq("farmer_id", str(farmer_id))
    if status:
        q = q.eq("status", status)
    res = q.order("created_at", desc=True).execute()
    return res.data or []


@router.post("")
async def create_ticket(
    body: TicketCreate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    res = db.table("farmer_tickets").insert({
        "farmer_id": str(farmer_id),
        **body.dict(),
    }).execute()
    if res.data:
        ticket = res.data[0]
        create_notifications_for_admins(
            db,
            title="New farmer support ticket",
            message=ticket.get("subject", "A new ticket was created."),
            notification_type="admin_ticket",
            action_url=f"/admin/tickets/{ticket['id']}",
            metadata={"ticket_id": ticket["id"], "farmer_id": str(farmer_id)},
        )
        return ticket
    return {}


@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    ticket = db.table("farmer_tickets").select("*").eq("id", ticket_id).eq("farmer_id", str(farmer_id)).single().execute()
    if not ticket.data:
        raise HTTPException(404, "Ticket not found")
    messages = db.table("ticket_messages").select("*").eq("ticket_id", ticket_id).order("created_at").execute()
    return {"ticket": ticket.data, "messages": messages.data or []}


@router.post("/{ticket_id}/messages")
async def send_ticket_message(
    ticket_id: str,
    body: TicketMessage,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    # Verify ownership
    ticket = db.table("farmer_tickets").select("id").eq("id", ticket_id).eq("farmer_id", str(farmer_id)).single().execute()
    if not ticket.data:
        raise HTTPException(404, "Ticket not found")
    res = db.table("ticket_messages").insert({
        "ticket_id": ticket_id,
        "sender_id": str(farmer_id),
        "message": body.message,
        "is_admin_reply": False,
    }).execute()
    # Update status to waiting_farmer → in_progress
    db.table("farmer_tickets").update({"status": "in_progress"}).eq("id", ticket_id).eq("status", "waiting_farmer").execute()
    ticket_detail = db.table("farmer_tickets").select("subject, assigned_admin_id").eq("id", ticket_id).single().execute()
    assigned_admin_id = (ticket_detail.data or {}).get("assigned_admin_id")
    if assigned_admin_id:
        create_notifications_for_admins(
            db,
            title="Farmer replied to a support ticket",
            message=(ticket_detail.data or {}).get("subject", "A ticket has a new farmer reply."),
            notification_type="admin_ticket",
            action_url=f"/admin/tickets/{ticket_id}",
            metadata={"ticket_id": ticket_id, "farmer_id": str(farmer_id)},
        )
    return res.data[0] if res.data else {}
