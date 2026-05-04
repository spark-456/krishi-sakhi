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

class HelpDecision(BaseModel):
    decision: str
    note: Optional[str] = None

class MessagePost(BaseModel):
    message: str
    message_type: str = "text"

class RouteCreate(BaseModel):
    route_name: str
    destination_type: str
    destination_name: str
    frequency: Optional[str] = None
    notes: Optional[str] = None

class ResourceDecision(BaseModel):
    decision: str
    note: Optional[str] = None

class RouteDecision(BaseModel):
    decision: str
    note: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _assert_member(db: Client, group_id: str, farmer_id: str):
    res = db.table("cooperative_memberships").select("id").eq("group_id", group_id).eq("farmer_id", farmer_id).execute()
    if not res.data:
        raise HTTPException(403, "You are not a member of this group")


def _get_farmer_name(db: Client, farmer_id: str) -> str:
    farmer = db.table("farmers").select("full_name").eq("id", farmer_id).single().execute()
    return (farmer.data or {}).get("full_name") or "A member"


def _post_group_event(
    db: Client,
    *,
    group_id: str,
    farmer_id: str,
    message: str,
    message_type: str,
):
    db.table("group_messages").insert({
        "group_id": group_id,
        "farmer_id": farmer_id,
        "message": message,
        "message_type": message_type,
    }).execute()


def _build_group_note(note: Optional[str]) -> str:
    clean = (note or "").strip()
    return f" Note: {clean}" if clean else ""


def _resource_decision_copy(decision: str) -> str:
    if decision == "interested":
        return "is interested in using this resource."
    if decision == "can_coordinate":
        return "can help coordinate this resource."
    if decision == "pass":
        return "does not need this resource right now."
    return "responded to this resource post."


def _route_decision_copy(decision: str) -> str:
    if decision == "join":
        return "can join this route."
    if decision == "can_coordinate":
        return "can help coordinate this route."
    if decision == "pass":
        return "cannot join this route right now."
    return "responded to this route post."


def _help_decision_copy(decision: str) -> str:
    if decision == "can_help":
        return "I can help with this request."
    if decision == "cannot_help":
        return "I cannot help with this request right now."
    return "Responded to this request."


def _event_message_type() -> str:
    return "alert"


def _normalize_resource_type(resource_type: Optional[str]) -> str:
    value = (resource_type or "").strip().lower()
    if value in {"equipment", "vehicle", "other"}:
        return "equipment"
    if value in {"storage", "land", "space"}:
        return "storage"
    if value == "seeds":
        return "seeds"
    return "equipment"


def _normalize_route_destination_type(destination_type: Optional[str]) -> str:
    value = (destination_type or "").strip().lower()
    if value in {"market", "mandi"}:
        return "mandi"
    return "bank"


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
    resource_payload = body.dict()
    resource_payload["resource_type"] = _normalize_resource_type(resource_payload.get("resource_type"))
    res = db.table("shared_resources").insert({
        "group_id": group_id,
        "farmer_id": str(farmer_id),
        **resource_payload,
    }).execute()
    if res.data:
        actor_name = _get_farmer_name(db, str(farmer_id))
        _post_group_event(
            db,
            group_id=group_id,
            farmer_id=str(farmer_id),
            message=f"{actor_name} shared a resource: {body.title}.",
            message_type=_event_message_type(),
        )
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
        "*, farmers!help_requests_farmer_id_fkey(full_name, village)"
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
        actor_name = _get_farmer_name(db, str(farmer_id))
        _post_group_event(
            db,
            group_id=group_id,
            farmer_id=str(farmer_id),
            message=f"{actor_name} posted a help request: {help_request.get('title', 'Need help')}.",
            message_type=_event_message_type(),
        )
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
    request_res = db.table("help_requests").select("title, farmer_id").eq("id", request_id).single().execute()
    if not request_res.data:
        raise HTTPException(404, "Help request not found")
    update_data = {"status": status}
    if status == "resolved":
        update_data["resolved_by"] = str(farmer_id)
        update_data["resolved_at"] = datetime.utcnow().isoformat()
    res = db.table("help_requests").update(update_data).eq("id", request_id).execute()
    if res.data:
        actor_name = _get_farmer_name(db, str(farmer_id))
        _post_group_event(
            db,
            group_id=group_id,
            farmer_id=str(farmer_id),
            message=f"{actor_name} marked help request '{request_res.data.get('title', 'request')}' as {status.replace('_', ' ')}.",
            message_type=_event_message_type(),
        )
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
    if res.data:
        actor_name = _get_farmer_name(db, str(farmer_id))
        _post_group_event(
            db,
            group_id=group_id,
            farmer_id=str(farmer_id),
            message=f"{actor_name} replied to help request '{request_detail.data.get('title', 'request')}': {body.message}",
            message_type=_event_message_type(),
        )
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


@router.post("/groups/{group_id}/help-requests/{request_id}/decision")
async def add_help_decision(
    group_id: str,
    request_id: str,
    body: HelpDecision,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    request_detail = db.table("help_requests").select("id, farmer_id, title, status").eq("id", request_id).single().execute()
    if not request_detail.data:
        raise HTTPException(404, "Help request not found")
    if request_detail.data.get("farmer_id") == str(farmer_id):
        raise HTTPException(400, "You cannot respond to your own request")

    message = f"{_help_decision_copy(body.decision)}{_build_group_note(body.note)}".strip()
    res = db.table("help_request_responses").insert({
        "request_id": request_id,
        "farmer_id": str(farmer_id),
        "message": message,
    }).execute()
    if not res.data:
        raise HTTPException(500, "Failed to record help response")

    if body.decision == "can_help" and request_detail.data.get("status") == "open":
        db.table("help_requests").update({"status": "in_progress"}).eq("id", request_id).execute()

    actor_name = _get_farmer_name(db, str(farmer_id))
    _post_group_event(
        db,
        group_id=group_id,
        farmer_id=str(farmer_id),
        message=f"{actor_name} responded to help request '{request_detail.data.get('title', 'request')}': {message}",
        message_type=_event_message_type(),
    )
    create_notification(
        db,
        farmer_id=request_detail.data["farmer_id"],
        title="New response to your help request",
        message=request_detail.data.get("title", "A member replied to your request."),
        notification_type="community",
        action_url=f"/community/groups/{group_id}",
        metadata={"request_id": request_id, "group_id": group_id},
    )
    return {"ok": True, "message": message}


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
    route_payload = body.dict()
    route_payload["destination_type"] = _normalize_route_destination_type(route_payload.get("destination_type"))
    res = db.table("common_routes").insert({
        "group_id": group_id,
        "created_by": str(farmer_id),
        **route_payload,
    }).execute()
    if res.data:
        actor_name = _get_farmer_name(db, str(farmer_id))
        _post_group_event(
            db,
            group_id=group_id,
            farmer_id=str(farmer_id),
            message=f"{actor_name} shared a route: {body.route_name}.",
            message_type=_event_message_type(),
        )
    return res.data[0] if res.data else {}


@router.post("/groups/{group_id}/resources/{resource_id}/decision")
async def decide_on_resource(
    group_id: str,
    resource_id: str,
    body: ResourceDecision,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    resource = db.table("shared_resources").select("id, farmer_id, title").eq("id", resource_id).single().execute()
    if not resource.data:
        raise HTTPException(404, "Resource not found")
    if resource.data.get("farmer_id") == str(farmer_id):
        raise HTTPException(400, "You cannot review your own resource post")

    actor_name = _get_farmer_name(db, str(farmer_id))
    message = f"{actor_name} {_resource_decision_copy(body.decision)} Resource: {resource.data.get('title', 'Shared resource')}.{_build_group_note(body.note)}"
    _post_group_event(
        db,
        group_id=group_id,
        farmer_id=str(farmer_id),
        message=message,
        message_type=_event_message_type(),
    )
    create_notification(
        db,
        farmer_id=resource.data["farmer_id"],
        title="New response to your shared resource",
        message=resource.data.get("title", "A member responded to your resource."),
        notification_type="community",
        action_url=f"/community/groups/{group_id}",
        metadata={"resource_id": resource_id, "group_id": group_id},
    )
    return {"ok": True, "message": message}


@router.post("/groups/{group_id}/routes/{route_id}/decision")
async def decide_on_route(
    group_id: str,
    route_id: str,
    body: RouteDecision,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    _assert_member(db, group_id, str(farmer_id))
    route = db.table("common_routes").select("id, created_by, route_name").eq("id", route_id).single().execute()
    if not route.data:
        raise HTTPException(404, "Route not found")
    if route.data.get("created_by") == str(farmer_id):
        raise HTTPException(400, "You cannot review your own route post")

    actor_name = _get_farmer_name(db, str(farmer_id))
    message = f"{actor_name} {_route_decision_copy(body.decision)} Route: {route.data.get('route_name', 'Shared route')}.{_build_group_note(body.note)}"
    _post_group_event(
        db,
        group_id=group_id,
        farmer_id=str(farmer_id),
        message=message,
        message_type=_event_message_type(),
    )
    create_notification(
        db,
        farmer_id=route.data["created_by"],
        title="New response to your shared route",
        message=route.data.get("route_name", "A member responded to your route."),
        notification_type="community",
        action_url=f"/community/groups/{group_id}",
        metadata={"route_id": route_id, "group_id": group_id},
    )
    return {"ok": True, "message": message}


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
