from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from dependencies import get_current_farmer_id, get_supabase, require_admin
from models.notification import NotificationListResponse, NotificationReadUpdate, NotificationResponse
from services.notifications import generate_daily_nudges

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _notifications_available(db: Client) -> bool:
    try:
        db.table("notifications").select("id").limit(1).execute()
        return True
    except Exception:
        return False


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = Query(25, ge=1, le=100),
    unread_only: bool = False,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    if not _notifications_available(db):
        return NotificationListResponse(notifications=[], unread_count=0)

    unread_query = (
        db.table("notifications")
        .select("id", count="exact")
        .eq("farmer_id", str(farmer_id))
        .eq("is_read", False)
    )
    unread_count = unread_query.execute().count or 0

    query = db.table("notifications").select("*").eq("farmer_id", str(farmer_id))
    if unread_only:
        query = query.eq("is_read", False)
    result = query.order("created_at", desc=True).limit(limit).execute()

    return NotificationListResponse(
        notifications=result.data or [],
        unread_count=unread_count,
    )


@router.patch("/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: UUID,
    body: NotificationReadUpdate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    if not _notifications_available(db):
        raise HTTPException(status_code=404, detail="Notifications are not available")

    result = (
        db.table("notifications")
        .update({"is_read": body.is_read})
        .eq("id", str(notification_id))
        .eq("farmer_id", str(farmer_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Notification not found")
    return result.data[0]


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    if not _notifications_available(db):
        return {"status": "ok", "notifications_available": False}

    db.table("notifications").update({"is_read": True}).eq("farmer_id", str(farmer_id)).eq("is_read", False).execute()
    return {"status": "ok"}


@router.post("/generate-nudges")
async def generate_notifications_nudges(
    run_date: date | None = None,
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    return await generate_daily_nudges(db, run_date=run_date)
