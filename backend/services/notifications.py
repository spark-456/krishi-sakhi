import logging
from datetime import date, datetime
from typing import Any, Iterable, Optional

import httpx
from supabase import Client

from config import settings

logger = logging.getLogger(__name__)


def create_notification(
    db: Client,
    farmer_id: str,
    title: str,
    message: str,
    notification_type: str = "info",
    action_url: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    dedupe_key: Optional[str] = None,
):
    if dedupe_key:
        existing = (
            db.table("notifications")
            .select("id")
            .eq("farmer_id", farmer_id)
            .eq("dedupe_key", dedupe_key)
            .limit(1)
            .execute()
        )
        if existing.data:
            return existing.data[0]

    payload = {
        "farmer_id": farmer_id,
        "title": title,
        "message": message,
        "type": notification_type,
        "action_url": action_url,
        "metadata": metadata or {},
        "dedupe_key": dedupe_key,
    }
    result = db.table("notifications").insert(payload).execute()
    return result.data[0] if result.data else None


def create_notifications_for_farmers(
    db: Client,
    farmer_ids: Iterable[str],
    title: str,
    message: str,
    notification_type: str = "info",
    action_url: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
):
    created = []
    for farmer_id in farmer_ids:
        if not farmer_id:
            continue
        created.append(
            create_notification(
                db=db,
                farmer_id=farmer_id,
                title=title,
                message=message,
                notification_type=notification_type,
                action_url=action_url,
                metadata=metadata,
            )
        )
    return [item for item in created if item]


def create_notifications_for_admins(
    db: Client,
    title: str,
    message: str,
    notification_type: str = "admin",
    action_url: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
):
    admins = db.table("farmers").select("id").eq("role", "admin").execute()
    admin_ids = [row["id"] for row in (admins.data or [])]
    return create_notifications_for_farmers(
        db=db,
        farmer_ids=admin_ids,
        title=title,
        message=message,
        notification_type=notification_type,
        action_url=action_url,
        metadata=metadata,
    )


def create_notifications_for_group_members(
    db: Client,
    group_id: str,
    exclude_farmer_id: Optional[str],
    title: str,
    message: str,
    notification_type: str = "community",
    action_url: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
):
    memberships = (
        db.table("cooperative_memberships")
        .select("farmer_id")
        .eq("group_id", group_id)
        .execute()
    )
    member_ids = []
    for membership in memberships.data or []:
        farmer_id = membership.get("farmer_id")
        if not farmer_id or farmer_id == exclude_farmer_id:
            continue
        member_ids.append(farmer_id)

    return create_notifications_for_farmers(
        db=db,
        farmer_ids=member_ids,
        title=title,
        message=message,
        notification_type=notification_type,
        action_url=action_url,
        metadata=metadata,
    )


async def generate_daily_nudges(db: Client, run_date: Optional[date] = None) -> dict[str, int]:
    reference_date = run_date or date.today()
    crops_res = (
        db.table("crop_records")
        .select("id, farmer_id, farm_id, crop_name, sowing_date, expected_harvest_date, growth_stage, status")
        .eq("status", "active")
        .execute()
    )
    farms_res = db.table("farms").select("id, farm_name, latitude, longitude").execute()
    farmers_res = db.table("farmers").select("id, district").execute()

    farms_by_id = {farm["id"]: farm for farm in (farms_res.data or [])}
    farmers_by_id = {farmer["id"]: farmer for farmer in (farmers_res.data or [])}

    created = 0
    evaluated = 0

    for crop in crops_res.data or []:
        farmer_id = crop.get("farmer_id")
        farm = farms_by_id.get(crop.get("farm_id"))
        farmer = farmers_by_id.get(farmer_id)
        if not farmer_id or not crop.get("sowing_date"):
            continue

        evaluated += 1
        crop_date = _parse_date(crop.get("sowing_date"))
        if not crop_date:
            continue

        days_since_sowing = (reference_date - crop_date).days
        crop_name = crop.get("crop_name") or "your crop"
        farm_name = (farm or {}).get("farm_name") or "your farm"
        rain_tomorrow_mm = await _fetch_tomorrow_rain_mm(farm)

        if rain_tomorrow_mm is not None and days_since_sowing >= 10 and days_since_sowing <= 18 and rain_tomorrow_mm >= 12:
            result = create_notification(
                db=db,
                farmer_id=farmer_id,
                title="Weather nudge for tomorrow",
                message=f"Heavy rain is likely near {farm_name}. Delay pesticide spraying on {crop_name} until conditions improve.",
                notification_type="weather_nudge",
                action_url="/assistant",
                metadata={
                    "crop_id": crop.get("id"),
                    "farm_id": crop.get("farm_id"),
                    "rain_tomorrow_mm": rain_tomorrow_mm,
                    "district": (farmer or {}).get("district"),
                },
                dedupe_key=f"rain-delay:{crop.get('id')}:{reference_date.isoformat()}",
            )
            if result:
                created += 1

        if days_since_sowing >= 12 and days_since_sowing <= 16:
            result = create_notification(
                db=db,
                farmer_id=farmer_id,
                title="Early crop check reminder",
                message=f"{crop_name} is about two weeks old on {farm_name}. Check for early pests, weak germination, and moisture stress today.",
                notification_type="crop_nudge",
                action_url="/activity",
                metadata={"crop_id": crop.get("id"), "farm_id": crop.get("farm_id")},
                dedupe_key=f"early-check:{crop.get('id')}:{reference_date.isoformat()}",
            )
            if result:
                created += 1

        if days_since_sowing >= 25 and days_since_sowing <= 35 and (rain_tomorrow_mm is None or rain_tomorrow_mm < 1):
            result = create_notification(
                db=db,
                farmer_id=farmer_id,
                title="Irrigation planning nudge",
                message=f"No meaningful rain is forecast for {farm_name}. Review irrigation needs for {crop_name} and log the next watering cycle.",
                notification_type="irrigation_nudge",
                action_url="/activity",
                metadata={"crop_id": crop.get("id"), "farm_id": crop.get("farm_id")},
                dedupe_key=f"irrigation-check:{crop.get('id')}:{reference_date.isoformat()}",
            )
            if result:
                created += 1

        if days_since_sowing >= 85 and days_since_sowing <= 105:
            result = create_notification(
                db=db,
                farmer_id=farmer_id,
                title="Harvest window approaching",
                message=f"{crop_name} on {farm_name} is nearing a likely harvest window. Review market timing and field readiness this week.",
                notification_type="harvest_nudge",
                action_url="/assistant",
                metadata={"crop_id": crop.get("id"), "farm_id": crop.get("farm_id")},
                dedupe_key=f"harvest-window:{crop.get('id')}:{reference_date.isoformat()}",
            )
            if result:
                created += 1

    return {"evaluated_crops": evaluated, "notifications_created": created}


def _parse_date(value: Any) -> Optional[date]:
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)).date()
    except ValueError:
        try:
            return date.fromisoformat(str(value))
        except ValueError:
            return None


async def _fetch_tomorrow_rain_mm(farm: Optional[dict[str, Any]]) -> Optional[float]:
    if not farm:
        return None
    lat = farm.get("latitude")
    lon = farm.get("longitude")
    if lat is None or lon is None:
        return None

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{settings.open_meteo_base_url}/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "daily": "precipitation_sum",
                    "forecast_days": 2,
                    "timezone": "auto",
                },
            )
            resp.raise_for_status()
            data = resp.json().get("daily", {})
            totals = data.get("precipitation_sum") or []
            if len(totals) >= 2:
                return float(totals[1] or 0)
            return None
    except Exception as exc:
        logger.warning("Failed to fetch forecast for nudges: %s", exc)
        return None
