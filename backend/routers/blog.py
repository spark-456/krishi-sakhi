"""
Blog router — farmer-side reading of published posts.
"""
from fastapi import APIRouter, Depends
from supabase import Client
from dependencies import get_supabase, get_current_farmer_id
from uuid import UUID
from typing import Optional

router = APIRouter(prefix="/blog", tags=["Blog"])


@router.get("")
async def list_blog_posts(
    category: Optional[str] = None,
    district: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    """List published blog posts, filtered by category or district."""
    q = db.table("blog_posts").select(
        "id, title, summary, category, tags, published_at, view_count, cover_image_url, target_district"
    ).eq("is_published", True)

    if category:
        q = q.eq("category", category)
    if district:
        # Posts targeting this district OR no district filter (all farmers)
        q = q.or_(f"target_district.eq.{district},target_district.is.null")

    res = q.order("published_at", desc=True).range(offset, offset + limit - 1).execute()
    return res.data or []


@router.get("/{post_id}")
async def get_blog_post(
    post_id: str,
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    """Get full post content and mark as read."""
    res = db.table("blog_posts").select("*").eq("id", post_id).eq("is_published", True).single().execute()
    if not res.data:
        from fastapi import HTTPException
        raise HTTPException(404, "Post not found")

    # Mark as read (upsert — idempotent)
    try:
        db.table("blog_post_reads").upsert({
            "post_id": post_id,
            "farmer_id": str(farmer_id),
        }).execute()
        # Increment view count
        db.table("blog_posts").update({"view_count": res.data["view_count"] + 1}).eq("id", post_id).execute()
    except Exception:
        pass  # Non-critical

    return res.data
