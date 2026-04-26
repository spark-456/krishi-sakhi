"""
Cooperative / SakhiNet router — farmer-side community and group management.
All endpoints require the farmer to be authenticated.
Group content (resources, help, messages, routes) requires group membership.
"""
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from dependencies import get_supabase, get_current_farmer_id
from uuid import UUID
from typing import Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
from services.notifications import create_notification, create_notifications_for_group_members

router = APIRouter(prefix="/cooperative", tags=["Cooperative"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    state: str
    district: str
    block: Optional[str] = None
    village: Optional[str] = None

class ResourceCreate(BaseModel):
    resource_type: str
    title: str
    description: Optional[str] = None
    availability_status: str = "available"
    quantity: Optional[str] = None
    cost_per_use: Optional[str] = None

class ResourceUpdate(BaseModel):
    availability_status: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[str] = None
    cost_per_use: Optional[str] = None

class HelpRequestCreate(BaseModel):
    category: str
    title: str
    description: Optional[str] = None
    urgency: str = "normal"
    expires_in_days: Optional[int] = 7

class HelpResponse(BaseModel):
    message: str

class MessagePost(BaseModel):
    message: str
    message_type: str = "text"

class RouteCreate(BaseModel):
    route_name: str
    destination_type: str
    destination_name: str
    frequency: Optional[str] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _assert_member(db: Client, group_id: str, farmer_id: str):
    res = db.table("cooperative_memberships").select("id").eq("group_id", group_id).eq("farmer_id", farmer_id).execute()
    if not res.data:
        raise HTTPException(403, "You are not a member of this group")


# ---------------------------------------------------------------------------
# Group Discovery & Creation
# ---------------------------------------------------------------------------

@router.get("/groups")
async def list_groups(
    district: Optional[str] = None,
    state: Optional[str] = None,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    """Discover groups in the farmer's region."""
    q = db.table("cooperative_groups").select(
        "id, name, description, district, state, block, village, member_count, created_at"
    ).eq("is_active", True)
    if district:
        q = q.eq("district", district)
    if state:
        q = q.eq("state", state)
    res = q.order("member_count", desc=True).execute()
    return res.data or []


@router.post("/groups")
async def create_group(
    body: GroupCreate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    """Create a new cooperative group. Creator auto-joins as admin."""
    group_data = body.dict()
    group_data["created_by"] = str(farmer_id)
    group_res = db.table("cooperative_groups").insert(group_data).execute()
    if not group_res.data:
        raise HTTPException(500, "Failed to create group")
    group = group_res.data[0]
    # Auto-join as admin
    db.table("cooperative_memberships").insert({
        "group_id": group["id"],
        "farmer_id": str(farmer_id),
        "role": "admin",
    }).execute()
    return group


@router.get("/my-groups")
async def my_groups(
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    """List all groups this farmer has joined."""
    memberships = db.table("cooperative_memberships").select(
        "role, joined_at, cooperative_groups(id, name, description, district, member_count)"
    ).eq("farmer_id", str(farmer_id)).execute()
    return memberships.data or []


@router.get("/groups/{group_id}")
async def get_group(
    group_id: str,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    res = db.table("cooperative_groups").select("*").eq("id", group_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Group not found")
    return res.data


# ---------------------------------------------------------------------------
# Join / Leave
# ---------------------------------------------------------------------------

@router.post("/groups/{group_id}/join")
async def join_group(
    group_id: str,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    existing = db.table("cooperative_memberships").select("id").eq("group_id", group_id).eq("farmer_id", str(farmer_id)).execute()
    if existing.data:
        raise HTTPException(400, "Already a member")
    res = db.table("cooperative_memberships").insert({
        "group_id": group_id,
        "farmer_id": str(farmer_id),
        "role": "member",
    }).execute()
    return res.data[0] if res.data else {}


@router.post("/groups/{group_id}/leave")
async def leave_group(
    group_id: str,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    db.table("cooperative_memberships").delete().eq("group_id", group_id).eq("farmer_id", str(farmer_id)).execute()
    return {"left": group_id}


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------

@router.get("/groups/{group_id}/members")
async def list_members(
    group_id: str,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    res = db.table("cooperative_memberships").select(
        "role, joined_at, farmers(id, full_name, district, village)"
    ).eq("group_id", group_id).execute()
    return res.data or []


# ---------------------------------------------------------------------------
# Shared Resources
# ---------------------------------------------------------------------------

@router.get("/groups/{group_id}/resources")
async def list_resources(
    group_id: str,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    res = db.table("shared_resources").select(
        "*, farmers(full_name, village)"
    ).eq("group_id", group_id).order("created_at", desc=True).execute()
    return res.data or []


@router.post("/groups/{group_id}/resources")
async def add_resource(
    group_id: str,
    body: ResourceCreate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    res = db.table("shared_resources").insert({
        "group_id": group_id,
        "farmer_id": str(farmer_id),
        **body.dict(),
    }).execute()
    return res.data[0] if res.data else {}


@router.patch("/groups/{group_id}/resources/{resource_id}")
async def update_resource(
    group_id: str,
    resource_id: str,
    body: ResourceUpdate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    update_data = {k: v for k, v in body.dict().items() if v is not None}
    res = db.table("shared_resources").update(update_data).eq("id", resource_id).eq("farmer_id", str(farmer_id)).execute()
    return res.data[0] if res.data else {}


@router.delete("/groups/{group_id}/resources/{resource_id}")
async def delete_resource(
    group_id: str,
    resource_id: str,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    db.table("shared_resources").delete().eq("id", resource_id).eq("farmer_id", str(farmer_id)).execute()
    return {"deleted": resource_id}


# ---------------------------------------------------------------------------
# Help Requests
# ---------------------------------------------------------------------------

@router.get("/groups/{group_id}/help-requests")
async def list_help_requests(
    group_id: str,
    status: Optional[str] = None,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    q = db.table("help_requests").select(
        "*, farmers(full_name, village)"
    ).eq("group_id", group_id)
    if status:
        q = q.eq("status", status)
    res = q.order("created_at", desc=True).execute()
    return res.data or []


@router.post("/groups/{group_id}/help-requests")
async def create_help_request(
    group_id: str,
    body: HelpRequestCreate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    data = body.dict(exclude={"expires_in_days"})
    data["group_id"] = group_id
    data["farmer_id"] = str(farmer_id)
    if body.expires_in_days:
        data["expires_at"] = (datetime.utcnow() + timedelta(days=body.expires_in_days)).isoformat()
    res = db.table("help_requests").insert(data).execute()
    if res.data:
        help_request = res.data[0]
        create_notifications_for_group_members(
            db,
            group_id=group_id,
            exclude_farmer_id=str(farmer_id),
            title="New SakhiNet help request",
            message=help_request.get("title", "A member posted a help request."),
            notification_type="community",
            action_url=f"/community/groups/{group_id}",
            metadata={"request_id": help_request["id"], "group_id": group_id},
        )
    return res.data[0] if res.data else {}


@router.patch("/groups/{group_id}/help-requests/{request_id}")
async def update_help_request(
    group_id: str,
    request_id: str,
    status: str,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    update_data = {"status": status}
    if status == "resolved":
        update_data["resolved_by"] = str(farmer_id)
        update_data["resolved_at"] = datetime.utcnow().isoformat()
    res = db.table("help_requests").update(update_data).eq("id", request_id).execute()
    return res.data[0] if res.data else {}


@router.get("/groups/{group_id}/help-requests/{request_id}/responses")
async def list_responses(
    group_id: str,
    request_id: str,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    res = db.table("help_request_responses").select(
        "*, farmers(full_name, village)"
    ).eq("request_id", request_id).order("created_at").execute()
    return res.data or []


@router.post("/groups/{group_id}/help-requests/{request_id}/responses")
async def add_response(
    group_id: str,
    request_id: str,
    body: HelpResponse,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    request_detail = db.table("help_requests").select("farmer_id, title").eq("id", request_id).single().execute()
    res = db.table("help_request_responses").insert({
        "request_id": request_id,
        "farmer_id": str(farmer_id),
        "message": body.message,
    }).execute()
    if request_detail.data and request_detail.data.get("farmer_id") != str(farmer_id):
        create_notification(
            db,
            farmer_id=request_detail.data["farmer_id"],
            title="New response to your help request",
            message=request_detail.data.get("title", "A member replied to your request."),
            notification_type="community",
            action_url=f"/community/groups/{group_id}",
            metadata={"request_id": request_id, "group_id": group_id},
        )
    return res.data[0] if res.data else {}


# ---------------------------------------------------------------------------
# Group Messages
# ---------------------------------------------------------------------------

@router.get("/groups/{group_id}/messages")
async def list_messages(
    group_id: str,
    limit: int = 50,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    res = db.table("group_messages").select(
        "*, farmers(full_name, village)"
    ).eq("group_id", group_id).order("created_at", desc=True).limit(limit).execute()
    return list(reversed(res.data or []))


@router.post("/groups/{group_id}/messages")
async def post_message(
    group_id: str,
    body: MessagePost,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    res = db.table("group_messages").insert({
        "group_id": group_id,
        "farmer_id": str(farmer_id),
        "message": body.message,
        "message_type": body.message_type,
    }).execute()
    return res.data[0] if res.data else {}


# ---------------------------------------------------------------------------
# Common Routes
# ---------------------------------------------------------------------------

@router.get("/groups/{group_id}/routes")
async def list_routes(
    group_id: str,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    res = db.table("common_routes").select(
        "*, farmers!common_routes_created_by_fkey(full_name)"
    ).eq("group_id", group_id).eq("is_active", True).execute()
    return res.data or []


@router.post("/groups/{group_id}/routes")
async def add_route(
    group_id: str,
    body: RouteCreate,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    res = db.table("common_routes").insert({
        "group_id": group_id,
        "created_by": str(farmer_id),
        **body.dict(),
    }).execute()
    return res.data[0] if res.data else {}


# ---------------------------------------------------------------------------
# AI Suggestions (farmer community recommendations)
# ---------------------------------------------------------------------------

@router.get("/suggestions")
async def get_suggestions(
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    """
    Returns smart suggestions:
    - Nearby farmers growing same crop
    - Groups in the same district not yet joined
    - Open help requests in joined groups
    """
    # Get farmer profile
    farmer = db.table("farmers").select("district, state").eq("id", str(farmer_id)).single().execute()
    if not farmer.data:
        return {"suggestions": []}

    district = farmer.data["district"]
    suggestions = []

    # 1. Groups in same district not yet joined
    joined_res = db.table("cooperative_memberships").select("group_id").eq("farmer_id", str(farmer_id)).execute()
    joined_ids = [m["group_id"] for m in (joined_res.data or [])]

    nearby_groups = db.table("cooperative_groups").select(
        "id, name, description, member_count"
    ).eq("district", district).eq("is_active", True).execute()

    for g in (nearby_groups.data or []):
        if g["id"] not in joined_ids:
            suggestions.append({
                "type": "group_to_join",
                "title": f"Join '{g['name']}' ({g['member_count']} members nearby)",
                "group_id": g["id"],
            })

    # 2. Open urgent help requests in joined groups
    if joined_ids:
        urgent = db.table("help_requests").select(
            "id, title, category, urgency, group_id"
        ).in_("group_id", joined_ids).eq("status", "open").eq("urgency", "urgent").execute()
        for h in (urgent.data or []):
            suggestions.append({
                "type": "urgent_help_request",
                "title": f"Urgent: {h['title']}",
                "request_id": h["id"],
                "group_id": h["group_id"],
            })

    return {"suggestions": suggestions[:10]}
