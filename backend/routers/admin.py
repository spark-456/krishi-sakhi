"""
Admin router — accessible only to farmers with role = 'admin'.
Provides dashboard stats, farmer directory, ticket management, and blog CRUD.
"""
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from dependencies import get_supabase, require_admin
from uuid import UUID
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/admin", tags=["Admin"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class BlogPostCreate(BaseModel):
    title: str
    summary: Optional[str] = None
    content: str
    category: str
    tags: list[str] = []
    target_district: Optional[str] = None
    target_state: Optional[str] = None
    cover_image_url: Optional[str] = None

class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    target_district: Optional[str] = None
    target_state: Optional[str] = None
    cover_image_url: Optional[str] = None

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_admin_id: Optional[str] = None
    resolution_notes: Optional[str] = None

class TicketReply(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard")
async def admin_dashboard(
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    """Aggregate stats for the admin overview screen."""
    farmers_res = db.table("farmers").select("id", count="exact").execute()
    open_tickets = db.table("farmer_tickets").select("id", count="exact").eq("status", "open").execute()
    critical_tickets = db.table("farmer_tickets").select("id", count="exact").eq("priority", "critical").neq("status", "closed").execute()
    published_posts = db.table("blog_posts").select("id", count="exact").eq("is_published", True).execute()
    coop_groups = db.table("cooperative_groups").select("id", count="exact").eq("is_active", True).execute()

    # Recent 5 tickets
    recent_tickets = (
        db.table("farmer_tickets")
        .select("id, subject, category, priority, status, created_at")
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    # Recent 5 registrations
    recent_farmers = (
        db.table("farmers")
        .select("id, full_name, district, state, created_at")
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    return {
        "stats": {
            "total_farmers": farmers_res.count or 0,
            "open_tickets": open_tickets.count or 0,
            "critical_tickets": critical_tickets.count or 0,
            "published_posts": published_posts.count or 0,
            "active_cooperatives": coop_groups.count or 0,
        },
        "recent_tickets": recent_tickets.data or [],
        "recent_registrations": recent_farmers.data or [],
    }


# ---------------------------------------------------------------------------
# Farmer Directory
# ---------------------------------------------------------------------------

@router.get("/farmers")
async def list_farmers(
    district: Optional[str] = None,
    state: Optional[str] = None,
    onboarding_complete: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    q = db.table("farmers").select(
        "id, full_name, phone_number, district, state, block, village, preferred_language, onboarding_complete, role, created_at"
    )
    if district:
        q = q.eq("district", district)
    if state:
        q = q.eq("state", state)
    if onboarding_complete is not None:
        q = q.eq("onboarding_complete", onboarding_complete)
    res = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return res.data or []


@router.get("/farmers/{farmer_id}")
async def get_farmer_detail(
    farmer_id: str,
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    """Full farmer profile with farms, active crops, and recent scan history."""
    farmer = db.table("farmers").select("*").eq("id", farmer_id).single().execute()
    if not farmer.data:
        raise HTTPException(404, "Farmer not found")

    farms = db.table("farms").select("*").eq("farmer_id", farmer_id).execute()
    crops = db.table("crop_records").select("*").eq("farmer_id", farmer_id).order("created_at", desc=True).limit(10).execute()
    soil_scans = db.table("soil_scans").select("*").eq("farmer_id", farmer_id).order("created_at", desc=True).limit(5).execute()
    pest_scans = db.table("pest_scans").select("*").eq("farmer_id", farmer_id).order("created_at", desc=True).limit(5).execute()
    sessions = db.table("advisory_sessions").select("id, started_at, ended_at, total_turns").eq("farmer_id", farmer_id).order("started_at", desc=True).limit(5).execute()
    tickets = db.table("farmer_tickets").select("id, subject, category, status, priority, created_at").eq("farmer_id", farmer_id).order("created_at", desc=True).execute()

    return {
        "farmer": farmer.data,
        "farms": farms.data or [],
        "crop_records": crops.data or [],
        "soil_scans": soil_scans.data or [],
        "pest_scans": pest_scans.data or [],
        "advisory_sessions": sessions.data or [],
        "tickets": tickets.data or [],
    }


# ---------------------------------------------------------------------------
# Ticket Management
# ---------------------------------------------------------------------------

@router.get("/tickets")
async def list_all_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    assigned_to_me: bool = False,
    limit: int = 50,
    offset: int = 0,
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    q = db.table("farmer_tickets").select(
        "*, farmers!farmer_tickets_farmer_id_fkey(full_name, district, phone_number)"
    )
    if status:
        q = q.eq("status", status)
    if priority:
        q = q.eq("priority", priority)
    if category:
        q = q.eq("category", category)
    if assigned_to_me:
        q = q.eq("assigned_admin_id", str(admin_id))
    res = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return res.data or []


@router.get("/tickets/{ticket_id}")
async def get_ticket_detail(
    ticket_id: str,
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    ticket = db.table("farmer_tickets").select("*").eq("id", ticket_id).single().execute()
    if not ticket.data:
        raise HTTPException(404, "Ticket not found")
    messages = db.table("ticket_messages").select("*").eq("ticket_id", ticket_id).order("created_at").execute()
    farmer = db.table("farmers").select("full_name, district, phone_number").eq("id", ticket.data["farmer_id"]).single().execute()
    return {
        "ticket": ticket.data,
        "farmer": farmer.data,
        "messages": messages.data or [],
    }


@router.patch("/tickets/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    body: TicketUpdate,
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    update_data = {k: v for k, v in body.dict().items() if v is not None}
    if "status" in update_data and update_data["status"] in ("resolved", "closed"):
        update_data["resolved_at"] = datetime.utcnow().isoformat()
    res = db.table("farmer_tickets").update(update_data).eq("id", ticket_id).execute()
    return res.data[0] if res.data else {}


@router.post("/tickets/{ticket_id}/messages")
async def admin_reply_to_ticket(
    ticket_id: str,
    body: TicketReply,
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    res = db.table("ticket_messages").insert({
        "ticket_id": ticket_id,
        "sender_id": str(admin_id),
        "message": body.message,
        "is_admin_reply": True,
    }).execute()
    # Auto-update ticket status to in_progress if open
    db.table("farmer_tickets").update({"status": "in_progress"}).eq("id", ticket_id).eq("status", "open").execute()
    return res.data[0] if res.data else {}


# ---------------------------------------------------------------------------
# Blog Management
# ---------------------------------------------------------------------------

@router.get("/blog")
async def list_blog_posts(
    include_drafts: bool = True,
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    q = db.table("blog_posts").select("id, title, category, is_published, published_at, view_count, created_at, tags, target_district")
    if not include_drafts:
        q = q.eq("is_published", True)
    res = q.order("created_at", desc=True).execute()
    return res.data or []


@router.post("/blog")
async def create_blog_post(
    body: BlogPostCreate,
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    data = body.dict()
    data["author_id"] = str(admin_id)
    res = db.table("blog_posts").insert(data).execute()
    return res.data[0] if res.data else {}


@router.get("/blog/{post_id}")
async def get_blog_post(
    post_id: str,
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    res = db.table("blog_posts").select("*").eq("id", post_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Post not found")
    return res.data


@router.patch("/blog/{post_id}")
async def update_blog_post(
    post_id: str,
    body: BlogPostUpdate,
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    update_data = {k: v for k, v in body.dict().items() if v is not None}
    res = db.table("blog_posts").update(update_data).eq("id", post_id).execute()
    return res.data[0] if res.data else {}


@router.post("/blog/{post_id}/publish")
async def publish_blog_post(
    post_id: str,
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    res = db.table("blog_posts").update({
        "is_published": True,
        "published_at": datetime.utcnow().isoformat(),
    }).eq("id", post_id).execute()
    return res.data[0] if res.data else {}


@router.delete("/blog/{post_id}")
async def delete_blog_post(
    post_id: str,
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    db.table("blog_posts").delete().eq("id", post_id).execute()
    return {"deleted": post_id}


# ---------------------------------------------------------------------------
# Network Graph Data (for Admin D3 visualisation)
# ---------------------------------------------------------------------------

@router.get("/network-graph")
async def get_network_graph(
    admin_id: UUID = Depends(require_admin),
    db: Client = Depends(get_supabase),
):
    """
    Returns nodes and edges for the D3 cooperative network graph.
    Node types: farmer, farm, group, location
    Edge types: membership, farm_ownership, group_location
    """
    # Farmers
    farmers = db.table("farmers").select("id, full_name, district, state, village").eq("onboarding_complete", True).execute()
    # Farms
    farms = db.table("farms").select("id, farm_name, farmer_id, soil_type, area_acres").execute()
    # Groups
    groups = db.table("cooperative_groups").select("id, name, district, state, village, member_count").eq("is_active", True).execute()
    # Memberships
    memberships = db.table("cooperative_memberships").select("id, farmer_id, group_id, role").execute()

    nodes = []
    edges = []

    # Farmer nodes
    for f in (farmers.data or []):
        nodes.append({
            "id": f"farmer_{f['id']}", "type": "farmer",
            "label": f["full_name"], "district": f["district"],
            "state": f["state"], "village": f.get("village"),
        })

    # Farm nodes + farmer→farm edges
    for farm in (farms.data or []):
        nodes.append({
            "id": f"farm_{farm['id']}", "type": "farm",
            "label": farm.get("farm_name") or "Farm",
            "soil_type": farm.get("soil_type"),
            "area_acres": farm.get("area_acres"),
        })
        edges.append({
            "source": f"farmer_{farm['farmer_id']}",
            "target": f"farm_{farm['id']}",
            "type": "farm_ownership",
        })

    # Group nodes + location nodes + group→location edges
    seen_locations = set()
    for g in (groups.data or []):
        nodes.append({
            "id": f"group_{g['id']}", "type": "group",
            "label": g["name"], "district": g["district"],
            "member_count": g["member_count"],
        })
        loc_key = f"{g['district']}_{g['state']}"
        if loc_key not in seen_locations:
            seen_locations.add(loc_key)
            nodes.append({
                "id": f"loc_{loc_key}", "type": "location",
                "label": f"{g['district']}, {g['state']}",
                "district": g["district"], "state": g["state"],
            })
        edges.append({
            "source": f"group_{g['id']}",
            "target": f"loc_{loc_key}",
            "type": "group_location",
        })

    # Membership edges (farmer → group)
    for m in (memberships.data or []):
        edges.append({
            "source": f"farmer_{m['farmer_id']}",
            "target": f"group_{m['group_id']}",
            "type": "membership",
            "role": m["role"],
        })

    return {"nodes": nodes, "edges": edges}
