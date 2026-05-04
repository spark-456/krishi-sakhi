from datetime import date, datetime, timedelta
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from supabase import Client

from dependencies import get_current_farmer_id, get_supabase
from services.weather_client import get_weather_for_district

router = APIRouter(prefix="/farmer-insights", tags=["Farmer Insights"])
logger = logging.getLogger(__name__)

TIMELINE_STAGES = [
    "land_prep",
    "sowing",
    "germination",
    "vegetative",
    "flowering",
    "fruiting",
    "maturity",
    "harvest",
    "post_harvest",
]

STAGE_HINTS = {
    "land_prep": "Prepare soil, line up seed and labour, and verify irrigation access.",
    "sowing": "Watch germination closely and avoid uneven first irrigation.",
    "germination": "Check emergence quality and re-sow patchy sections early.",
    "vegetative": "Track growth, weed pressure, and input timing carefully.",
    "flowering": "Flowering stage is sensitive. Avoid stress and scout for pests.",
    "fruiting": "Protect yield now with timely irrigation and damage monitoring.",
    "maturity": "Start harvest planning, buyer coordination, and labour prep.",
    "harvest": "Record harvest, selling details, and post-harvest handling losses.",
    "post_harvest": "Close the season by logging yield, revenue, and key lessons.",
}


@router.get("/today")
async def get_today_view(
    farmer_id: UUID = Depends(get_current_farmer_id),
    db: Client = Depends(get_supabase),
):
    farmer_res = db.table("farmers").select("*").eq("id", str(farmer_id)).single().execute()
    farmer = farmer_res.data or {}

    farms_res = db.table("farms").select("*").eq("farmer_id", str(farmer_id)).execute()
    farms = farms_res.data or []
    farm_ids = [farm["id"] for farm in farms if farm.get("id")]
    farm_map = {farm["id"]: farm for farm in farms if farm.get("id")}

    crops_res = db.table("crop_records").select("*").eq("farmer_id", str(farmer_id)).execute()
    crops = crops_res.data or []
    active_crops = [crop for crop in crops if crop.get("status") == "active"]

    expenses_res = db.table("expense_logs").select("*").eq("farmer_id", str(farmer_id)).execute()
    expenses = expenses_res.data or []

    yields_res = db.table("yield_records").select("*").eq("farmer_id", str(farmer_id)).execute()
    yields = yields_res.data or []

    notifications_res = (
        db.table("notifications")
        .select("id, title, message, type, is_read, action_url, created_at")
        .eq("farmer_id", str(farmer_id))
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    notifications = notifications_res.data or []
    unread_notifications = sum(1 for item in notifications if not item.get("is_read"))

    tickets_res = db.table("farmer_tickets").select("id, status").eq("farmer_id", str(farmer_id)).execute()
    tickets = tickets_res.data or []
    open_tickets = [ticket for ticket in tickets if ticket.get("status") not in {"resolved", "closed"}]

    memberships_res = db.table("cooperative_memberships").select("group_id").eq("farmer_id", str(farmer_id)).execute()
    group_ids = [row["group_id"] for row in (memberships_res.data or []) if row.get("group_id")]

    help_requests = []
    resources = []
    routes = []
    if group_ids:
        help_requests = (
            db.table("help_requests")
            .select("id, urgency, status, title, group_id")
            .in_("group_id", group_ids)
            .eq("status", "open")
            .execute()
            .data
            or []
        )
        resources = (
            db.table("shared_resources")
            .select("id, availability_status")
            .in_("group_id", group_ids)
            .execute()
            .data
            or []
        )
        routes = (
            db.table("common_routes")
            .select("id, is_active")
            .in_("group_id", group_ids)
            .eq("is_active", True)
            .execute()
            .data
            or []
        )

    district = farmer.get("district")
    primary_farm = next(
        (farm for farm in farms if farm.get("latitude") is not None and farm.get("longitude") is not None),
        None,
    )
    weather = await _build_weather_snapshot(
        district=district,
        state=farmer.get("state"),
        primary_farm=primary_farm,
        db=db,
    )

    recent_activities = (
        db.table("activity_logs")
        .select("*")
        .eq("farmer_id", str(farmer_id))
        .order("date", desc=True)
        .limit(20)
        .execute()
        .data
        or []
    )

    recommended_posts_query = db.table("blog_posts").select(
        "id, title, summary, category, tags, published_at, target_district"
    ).eq("is_published", True)
    if district:
        recommended_posts_query = recommended_posts_query.or_(f"target_district.eq.{district},target_district.is.null")
    recommended_posts = recommended_posts_query.order("published_at", desc=True).limit(3).execute().data or []

    today_tasks = _build_today_tasks(
        weather=weather,
        active_crops=active_crops,
        all_crops=crops,
        recent_activities=recent_activities,
        yields=yields,
        open_tickets=open_tickets,
        help_requests=help_requests,
        farm_map=farm_map,
    )
    season_timeline = _build_season_timeline(active_crops, farm_map)
    quick_stats = _build_quick_stats(
        farms=farms,
        active_crops=active_crops,
        open_tickets=open_tickets,
        help_requests=help_requests,
        unread_notifications=unread_notifications,
        resources=resources,
        routes=routes,
    )
    finance_summary = _build_finance_summary(expenses, yields)
    daily_brief = _build_daily_brief(weather, today_tasks, finance_summary, active_crops)

    return {
        "farmer": {
            "full_name": farmer.get("full_name"),
            "district": farmer.get("district"),
            "state": farmer.get("state"),
            "preferred_language": farmer.get("preferred_language"),
        },
        "weather": weather,
        "daily_brief": daily_brief,
        "quick_stats": quick_stats,
        "today_tasks": today_tasks[:5],
        "season_timeline": season_timeline[:4],
        "finance_summary": finance_summary,
        "community_summary": {
            "group_count": len(group_ids),
            "open_help_requests": len(help_requests),
            "urgent_help_requests": sum(1 for item in help_requests if item.get("urgency") == "urgent"),
            "available_resources": sum(1 for item in resources if item.get("availability_status") == "available"),
            "active_routes": len(routes),
        },
        "notifications": notifications,
        "recommended_posts": recommended_posts,
    }


async def _build_weather_snapshot(
    *,
    district: str | None,
    state: str | None,
    primary_farm: dict[str, Any] | None,
    db: Client,
) -> dict[str, Any]:
    fallback = {
        "temp": 32,
        "condition": "Sunny",
        "humidity": 65,
        "rainfall": 0,
        "forecast": "Clear skies expected (Fallback)",
        "source": "fallback",
        "location_label": district or "Weather unavailable",
    }
    if not district:
        return {**fallback, "location_label": "Weather unavailable", "forecast": "Unavailable"}

    try:
        weather = await get_weather_for_district(
            district,
            db,
            state=state,
            fallback_lat=(primary_farm or {}).get("latitude"),
            fallback_lon=(primary_farm or {}).get("longitude"),
        )
        temp = weather.get("temp")
        rainfall = weather.get("rainfall")
        condition = weather.get("condition") or ("Rainy" if rainfall and rainfall > 0.5 else "Sunny")
        if temp is None:
            return fallback
        return {
            "temp": round(temp),
            "condition": condition,
            "humidity": weather.get("humidity"),
            "rainfall": rainfall if rainfall is not None else 0,
            "forecast": weather.get("forecast") or f"{district} - {condition}",
            "source": "open-meteo",
            "location_label": district,
            "latitude": weather.get("latitude"),
            "longitude": weather.get("longitude"),
        }
    except Exception as exc:
        logger.error("[Today View] Weather snapshot failed: %s", exc)
        return fallback


def _build_today_tasks(
    weather: dict[str, Any],
    active_crops: list[dict[str, Any]],
    all_crops: list[dict[str, Any]],
    recent_activities: list[dict[str, Any]],
    yields: list[dict[str, Any]],
    open_tickets: list[dict[str, Any]],
    help_requests: list[dict[str, Any]],
    farm_map: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    tasks: list[dict[str, Any]] = []
    rainfall = weather.get("rainfall")
    if rainfall is not None and rainfall > 0.5:
        tasks.append({
            "title": "Rain likely. Delay spraying if possible.",
            "subtitle": "Wet conditions can reduce spray effectiveness and raise drift or wash-off losses.",
            "route": "/assistant",
            "priority": "high",
            "kind": "weather",
        })

    activity_cutoff = date.today() - timedelta(days=7)
    recent_by_farm = {item.get("farm_id"): item for item in recent_activities if item.get("farm_id")}
    for crop in active_crops:
        farm = farm_map.get(crop.get("farm_id"))
        latest_activity = recent_by_farm.get(crop.get("farm_id"))
        latest_date = _safe_date((latest_activity or {}).get("date"))
        if latest_date is None or latest_date < activity_cutoff:
            tasks.append({
                "title": f"Review {crop.get('crop_name') or 'your crop'} on {farm.get('farm_name') if farm else 'farm'}",
                "subtitle": "No recent activity was logged for this farm in the last 7 days.",
                "route": "/activity",
                "priority": "medium",
                "kind": "activity",
            })
        if crop.get("growth_stage") in {"flowering", "fruiting"}:
            tasks.append({
                "title": f"Scout {crop.get('crop_name')} during {crop.get('growth_stage').replace('_', ' ')}",
                "subtitle": STAGE_HINTS.get(crop.get("growth_stage"), "Monitor crop condition closely."),
                "route": "/camera",
                "priority": "medium",
                "kind": "crop_stage",
            })

    harvested_ids = {row.get("crop_record_id") for row in yields if row.get("crop_record_id")}
    for crop in all_crops:
        if crop.get("status") == "harvested" and crop.get("id") not in harvested_ids:
            tasks.append({
                "title": f"Log yield for {crop.get('crop_name')}",
                "subtitle": "Add your sale quantity and price to unlock profit/loss tracking.",
                "route": "/finance",
                "priority": "high",
                "kind": "finance",
            })

    if open_tickets:
        tasks.append({
            "title": "Check support ticket updates",
            "subtitle": f"{len(open_tickets)} support request(s) are still active.",
            "route": "/tickets",
            "priority": "medium",
            "kind": "ticket",
        })

    urgent_help = [item for item in help_requests if item.get("urgency") == "urgent"]
    if urgent_help:
        tasks.append({
            "title": "Respond to urgent SakhiNet requests",
            "subtitle": f"{len(urgent_help)} urgent community help request(s) need attention.",
            "route": "/community",
            "priority": "medium",
            "kind": "community",
        })

    seen = set()
    unique_tasks = []
    for task in tasks:
        key = (task["title"], task["route"])
        if key in seen:
            continue
        seen.add(key)
        unique_tasks.append(task)
    if not unique_tasks and active_crops:
        unique_tasks.append({
            "title": "Review today's crop plan with Ask Sakhi",
            "subtitle": "No urgent blockers were detected, so use Sakhi to check the next best action for your active crops.",
            "route": "/assistant",
            "priority": "low",
            "kind": "weather",
        })
    elif not unique_tasks and farm_map:
        unique_tasks.append({
            "title": "Update your farm and crop records",
            "subtitle": "Keep today's records current so recommendations, profit/loss, and alerts stay accurate.",
            "route": "/farms",
            "priority": "low",
            "kind": "activity",
        })
    return unique_tasks


def _build_season_timeline(active_crops: list[dict[str, Any]], farm_map: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    timeline = []
    for crop in active_crops:
        stage = (crop.get("growth_stage") or "vegetative").replace("-", "_")
        if stage not in TIMELINE_STAGES:
            stage = "vegetative"
        stage_index = TIMELINE_STAGES.index(stage)
        next_stage = TIMELINE_STAGES[min(stage_index + 1, len(TIMELINE_STAGES) - 1)]
        sowing_date = _safe_date(crop.get("sowing_date"))
        expected_harvest_date = _safe_date(crop.get("expected_harvest_date"))
        days_since_sowing = (date.today() - sowing_date).days if sowing_date else None

        progress = (stage_index / (len(TIMELINE_STAGES) - 1)) * 100
        if sowing_date and expected_harvest_date and expected_harvest_date > sowing_date:
            total_days = (expected_harvest_date - sowing_date).days
            elapsed_days = max((date.today() - sowing_date).days, 0)
            progress = min(max((elapsed_days / total_days) * 100, progress), 100)

        timeline.append({
            "crop_id": crop.get("id"),
            "crop_name": crop.get("crop_name"),
            "farm_name": (farm_map.get(crop.get("farm_id")) or {}).get("farm_name"),
            "current_stage": stage,
            "next_stage": next_stage,
            "progress_pct": round(progress),
            "days_since_sowing": days_since_sowing,
            "hint": STAGE_HINTS.get(stage),
        })

    timeline.sort(key=lambda item: (item["days_since_sowing"] is None, -(item["days_since_sowing"] or 0)))
    return timeline


def _build_quick_stats(
    farms: list[dict[str, Any]],
    active_crops: list[dict[str, Any]],
    open_tickets: list[dict[str, Any]],
    help_requests: list[dict[str, Any]],
    unread_notifications: int,
    resources: list[dict[str, Any]],
    routes: list[dict[str, Any]],
) -> dict[str, int]:
    return {
        "farm_count": len(farms),
        "active_crop_count": len(active_crops),
        "open_ticket_count": len(open_tickets),
        "open_help_request_count": len(help_requests),
        "unread_notification_count": unread_notifications,
        "available_resource_count": sum(1 for item in resources if item.get("availability_status") == "available"),
        "active_route_count": len(routes),
    }


def _build_finance_summary(expenses: list[dict[str, Any]], yields: list[dict[str, Any]]) -> dict[str, Any]:
    recent_cutoff = date.today() - timedelta(days=30)
    total_expense = sum(float(item.get("amount_inr") or 0) for item in expenses)
    expense_last_30d = sum(
        float(item.get("amount_inr") or 0)
        for item in expenses
        if (_safe_date(item.get("expense_date")) or date.min) >= recent_cutoff
    )
    total_revenue = sum(
        float(item.get("yield_kg") or 0) * float(item.get("sale_price_per_kg") or 0)
        for item in yields
    )
    top_category = None
    category_totals: dict[str, float] = {}
    for item in expenses:
        category = item.get("category") or "other"
        category_totals[category] = category_totals.get(category, 0) + float(item.get("amount_inr") or 0)
    if category_totals:
        top_category = max(category_totals.items(), key=lambda pair: pair[1])[0]

    return {
        "expense_total": round(total_expense, 2),
        "expense_last_30d": round(expense_last_30d, 2),
        "revenue_total": round(total_revenue, 2),
        "profit_loss": round(total_revenue - total_expense, 2),
        "top_expense_category": top_category,
    }


def _build_daily_brief(
    weather: dict[str, Any],
    today_tasks: list[dict[str, Any]],
    finance_summary: dict[str, Any],
    active_crops: list[dict[str, Any]],
) -> dict[str, Any]:
    rainfall = weather.get("rainfall")
    if rainfall is not None and rainfall > 0.5:
        headline = "Rain-led planning day"
        tone = "watch"
        body = "Rain is showing in the current weather feed. Prioritize scouting and delay spray-heavy work if possible."
    elif any(crop.get("growth_stage") in {"flowering", "fruiting"} for crop in active_crops):
        headline = "Sensitive crop window"
        tone = "focus"
        body = "At least one active crop is in a yield-sensitive stage. Keep irrigation, scouting, and stress management tight."
    elif finance_summary.get("profit_loss", 0) < 0 and finance_summary.get("expense_total", 0) > 0:
        headline = "Protect your margins"
        tone = "review"
        body = "Recorded costs are currently higher than realized revenue. Review expense timing and log any missing sales."
    else:
        headline = "Stable operating day"
        tone = "steady"
        body = "No major risk spikes were detected from your current records. Use today to keep logs current and check crop condition."

    return {
        "headline": headline,
        "tone": tone,
        "body": body,
        "task_count": len(today_tasks),
    }


def _safe_date(value: Any) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except ValueError:
        return None
