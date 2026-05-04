import re
from datetime import date, datetime, timedelta
from typing import Any, Optional

from supabase import Client

from services.notifications import (
    create_notification,
    create_notifications_for_admins,
    create_notifications_for_group_members,
)

ACTIVITY_KEYWORDS = {
    "planting": ["planted", "plant ", "sowed", "seeded", "transplanted"],
    "irrigation": ["irrigated", "watered"],
    "fertilizer": ["fertilized", "applied fertilizer", "added urea", "added manure", "added dap"],
    "pesticide": ["sprayed", "applied pesticide", "used pesticide", "used insecticide", "sprayed medicine"],
    "weeding": ["weeded", "did weeding", "removed weeds"],
    "pruning": ["pruned", "did pruning", "trimmed plants"],
    "harvest": ["harvested", "completed harvest", "finished harvest"],
    "soil_test": ["tested soil", "did soil test", "checked soil"],
    "growth_update": ["growth update", "plant height", "crop reached"],
}

EXPENSE_CATEGORY_KEYWORDS = {
    "seeds": ["seed", "seeds", "sapling", "nursery"],
    "fertilizer": ["fertilizer", "urea", "dap", "potash", "manure"],
    "pesticide": ["pesticide", "fungicide", "insecticide", "spray", "medicine"],
    "labour": ["labour", "labor", "worker", "workers", "wages"],
    "irrigation": ["irrigation", "diesel", "water", "pump", "electricity"],
    "equipment": ["tractor", "sprayer", "equipment", "repair", "machine", "rotavator"],
}

BUYER_TYPE_KEYWORDS = {
    "mandi": ["mandi", "market yard", "apmc"],
    "trader": ["trader", "dealer", "commission agent"],
    "direct": ["direct", "customer", "retail", "local buyer"],
    "cooperative": ["cooperative", "society", "fpo", "group sale"],
}

TICKET_CATEGORY_KEYWORDS = {
    "irrigation": ["irrigation", "pump", "borewell", "water", "drip"],
    "pest_disease": ["pest", "disease", "fungus", "leaf spot", "blight", "worm", "insect"],
    "market_access": ["market", "mandi", "price", "selling", "buyer", "transport"],
    "finance": ["loan", "credit", "payment", "subsidy", "insurance"],
    "equipment": ["tractor", "machine", "equipment", "sprayer", "repair"],
    "account": ["login", "otp", "account", "app", "profile"],
    "weather": ["weather", "rain", "wind", "storm", "forecast"],
}

HELP_CATEGORY_KEYWORDS = {
    "equipment_needed": ["tractor", "sprayer", "equipment", "rotavator", "machine"],
    "labour_needed": ["labor", "labour", "worker", "workers", "harvest help"],
    "seeds_needed": ["seed", "seeds", "sapling"],
    "transport_share": ["transport", "truck", "tempo", "mandi"],
    "advice_needed": ["advice", "help", "guidance", "suggestion"],
}

RESOURCE_TYPE_KEYWORDS = {
    "equipment": ["tractor", "sprayer", "rotavator", "pump", "machine", "equipment"],
    "seeds": ["seed", "seeds", "sapling", "fertilizer", "input"],
    "vehicle": ["vehicle", "pickup", "tempo", "truck", "transport", "bike"],
    "land": ["storage", "warehouse", "godown", "land", "space", "room"],
}

ROUTE_DESTINATION_KEYWORDS = {
    "market": ["market", "mandi", "apmc", "yard"],
    "storage": ["storage", "warehouse", "cold room", "godown"],
    "supplier": ["supplier", "dealer", "seed shop", "fertilizer shop", "service center"],
}

STAGE_KEYWORDS = {
    "land_prep": ["land preparation", "land prep"],
    "germination": ["germination", "sprouting"],
    "sowing": ["sowing", "seedling stage"],
    "vegetative": ["vegetative", "leaf stage"],
    "flowering": ["flowering", "flower stage", "blooming"],
    "fruiting": ["fruiting", "fruit stage", "pod stage", "boll stage"],
    "maturity": ["maturity", "mature", "ready stage"],
    "harvest": ["harvest stage", "ready for harvest"],
    "post_harvest": ["post harvest", "after harvest"],
}

SOIL_TYPES = ["black", "red", "alluvial", "clay", "loam", "sandy"]
IRRIGATION_TYPES = ["rainfed", "drip", "canal", "borewell", "other"]
SEASONS = ["kharif", "rabi", "zaid"]

CREATE_FARM_CUES = [
    "create a new farm",
    "add a new farm",
    "create farm",
    "add farm",
    "new farm",
    "set up a farm",
    "setup a farm",
]

CREATE_CROP_CUES = [
    "add crop",
    "create crop",
    "new crop",
    "plant ",
    "planted ",
    "sow ",
    "sowed ",
    "seeded ",
]

TICKET_CUES = [
    "raise a ticket",
    "open a ticket",
    "create a ticket",
    "log a ticket",
    "submit a ticket",
    "register a complaint",
    "raise complaint",
    "report this issue",
]

HELP_REQUEST_CUES = [
    "ask my group",
    "post in group",
    "post to group",
    "create help request",
    "help request in group",
    "ask the group",
]

RESOURCE_CUES = [
    "share resource",
    "add resource",
    "offer resource",
    "share my",
    "offer my",
    "can share my",
    "my tractor is available",
    "my sprayer is available",
    "available for use",
]

ROUTE_CUES = [
    "add route",
    "share route",
    "common route",
    "mandi trip",
    "transport route",
    "weekly trip",
    "going to mandi",
    "going to market",
]

HELP_INTENT_WORDS = [
    "need help",
    "need support",
    "can someone help",
    "anyone can help",
    "looking for help",
    "looking for support",
]

RESOURCE_INTENT_WORDS = [
    "available",
    "can share",
    "share my",
    "offer my",
    "lend",
    "for use",
]

ROUTE_INTENT_WORDS = [
    "going to",
    "trip to",
    "ride to",
    "travel to",
    "anyone joining",
    "anyone wants to join",
]

CLAUSE_STARTERS = [
    "i spent",
    "spent",
    "i paid",
    "paid",
    "i bought",
    "bought",
    "i purchased",
    "purchased",
    "raise a ticket",
    "open a ticket",
    "create a ticket",
    "submit a ticket",
    "register a complaint",
    "ask my group",
    "post in group",
    "post to group",
    "create help request",
    "create a new farm",
    "add a new farm",
    "create farm",
    "add farm",
    "new farm",
    "set up a farm",
    "setup a farm",
    "add crop",
    "create crop",
    "new crop",
    "plant ",
    "planted ",
    "sow ",
    "sowed ",
    "seeded ",
    "i irrigated",
    "irrigated",
    "watered",
    "fertilized",
    "sprayed",
    "harvested",
    "my crop is",
    "my crops are",
    "my field is",
]


async def plan_and_execute_agent_actions(
    user_input: str,
    farmer_id: str,
    context: dict[str, Any],
    db: Client,
) -> dict[str, Any]:
    normalized = _normalize(user_input)
    if not normalized:
        return {"executed_actions": [], "refresh_targets": [], "follow_up_message": None}

    state = _build_state(context, db, farmer_id)
    clauses = _split_into_clauses(user_input)
    executed_actions: list[dict[str, Any]] = []
    refresh_targets: set[str] = set()
    follow_up_messages: list[str] = []
    seen_signatures: set[str] = set()

    for clause_text in clauses:
        clause = {
            "text": clause_text.strip(),
            "normalized": _normalize(clause_text),
        }
        if not clause["normalized"]:
            continue

        actions = _detect_actions_for_clause(clause, state)
        for action in actions:
            signature = _action_signature(action)
            if signature in seen_signatures:
                continue
            seen_signatures.add(signature)

            result = _execute_action(action, farmer_id, state, db)
            if result.get("status") == "needs_follow_up":
                follow_up_messages.append(result["message"])
                continue
            if result.get("status") in {"success", "skipped"}:
                executed_actions.append(result)
                refresh_targets.update(result.get("refresh_targets", []))
                _apply_action_result_to_state(action, result, state, farmer_id)
            elif result.get("message"):
                executed_actions.append(result)

    follow_up_message = " ".join(dict.fromkeys(follow_up_messages)) if follow_up_messages else None
    return {
        "executed_actions": executed_actions,
        "refresh_targets": sorted(refresh_targets),
        "follow_up_message": follow_up_message,
    }


def _build_state(context: dict[str, Any], db: Client, farmer_id: str) -> dict[str, Any]:
    return {
        "context": {
            "farms": list(context.get("farms", [])),
            "crops": list(context.get("crops", [])),
            "expenses": list(context.get("expenses", [])),
            "yields": list(context.get("yields", [])),
        },
        "groups": _load_farmer_groups(db, farmer_id),
        "ref_crops": _load_reference_crop_names(db),
        "last_created_farm": None,
        "last_created_crop": None,
    }


def _detect_actions_for_clause(clause: dict[str, str], state: dict[str, Any]) -> list[dict[str, Any]]:
    normalized = clause["normalized"]
    text = clause["text"]
    actions: list[dict[str, Any]] = []

    create_farm = _detect_create_farm(clause)
    if create_farm:
        actions.append(create_farm)

    create_crop = _detect_create_crop(clause, state)
    if create_crop:
        actions.append(create_crop)

    yield_sale = _detect_yield_sale(clause, state)
    if yield_sale:
        actions.append(yield_sale)

    expense = _detect_expense(clause, state)
    if expense:
        actions.append(expense)

    update_expense = _detect_update_expense(clause, state)
    if update_expense:
        actions.append(update_expense)

    help_request = _detect_help_request(clause, state)
    if help_request:
        actions.append(help_request)

    resource = _detect_resource_share(clause, state)
    if resource:
        actions.append(resource)

    route = _detect_route_share(clause, state)
    if route:
        actions.append(route)

    ticket = _detect_ticket(clause)
    if ticket:
        actions.append(ticket)

    crop_update = _detect_crop_update(clause, state, create_crop=create_crop)
    if crop_update:
        actions.append(crop_update)

    activity = _detect_activity(clause, state, create_crop=create_crop)
    if activity:
        actions.append(activity)

    if not actions and any(word in normalized for word in ["farm", "crop", "ticket", "group", "expense", "spent", "paid", "irrigated", "harvested"]):
        maybe_farm_update = _detect_update_farm(clause, state)
        if maybe_farm_update:
            actions.append(maybe_farm_update)

    return actions


def _detect_create_farm(clause: dict[str, str]) -> Optional[dict[str, Any]]:
    normalized = clause["normalized"]
    if not any(cue in normalized for cue in CREATE_FARM_CUES):
        return None

    farm_name = _extract_farm_name_from_clause(clause["text"], normalized)
    if not farm_name:
        return {
            "type": "create_farm",
            "farm_name": None,
            "area_acres": _extract_area_acres(normalized),
            "soil_type": _extract_soil_type(normalized),
            "irrigation_type": _extract_irrigation_type(normalized),
            "source_text": clause["text"],
        }

    return {
        "type": "create_farm",
        "farm_name": farm_name,
        "area_acres": _extract_area_acres(normalized),
        "soil_type": _extract_soil_type(normalized),
        "irrigation_type": _extract_irrigation_type(normalized),
        "source_text": clause["text"],
    }


def _detect_update_farm(clause: dict[str, str], state: dict[str, Any]) -> Optional[dict[str, Any]]:
    normalized = clause["normalized"]
    if not any(word in normalized for word in ["update", "change", "set"]):
        return None

    farm = _resolve_farm(state, normalized, allow_last_created=True)
    if not farm:
        return None

    area = _extract_area_acres(normalized)
    soil_type = _extract_soil_type(normalized)
    irrigation_type = _extract_irrigation_type(normalized)
    if area is None and soil_type is None and irrigation_type is None:
        return None

    return {
        "type": "update_farm",
        "farm_id": farm.get("id"),
        "farm_name": farm.get("farm_name"),
        "area_acres": area,
        "soil_type": soil_type,
        "irrigation_type": irrigation_type,
        "source_text": clause["text"],
    }


def _detect_create_crop(clause: dict[str, str], state: dict[str, Any]) -> Optional[dict[str, Any]]:
    normalized = clause["normalized"]
    if not any(cue in normalized for cue in CREATE_CROP_CUES):
        return None

    crop_name = _extract_crop_name(normalized, state["ref_crops"])
    if not crop_name:
        crop_name = _extract_crop_name_from_pattern(clause["text"], normalized)

    farm = _resolve_farm(state, normalized, allow_last_created=True)
    crop_date = _resolve_relative_date(normalized) or date.today()
    season = _extract_season(normalized) or _infer_season_for_date(crop_date)
    growth_stage = _match_stage(normalized) or "sowing"

    return {
        "type": "create_crop",
        "farm_id": (farm or {}).get("id"),
        "farm_name": (farm or {}).get("farm_name"),
        "crop_name": crop_name,
        "season": season,
        "growth_stage": growth_stage,
        "sowing_date": crop_date,
        "notes": clause["text"].strip(),
    }


def _detect_activity(clause: dict[str, str], state: dict[str, Any], create_crop: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    normalized = clause["normalized"]
    if create_crop and create_crop.get("type") == "create_crop" and any(word in normalized for word in ["plant", "planted", "sow", "sowed", "seeded", "transplanted"]):
        return None

    for activity_type, keywords in ACTIVITY_KEYWORDS.items():
        if not any(keyword in normalized for keyword in keywords):
            continue

        farm = _resolve_farm(state, normalized, allow_last_created=True)
        crop = _resolve_crop(state, normalized, farm_id=(farm or {}).get("id"), allow_last_created=True)
        activity_date = _resolve_relative_date(normalized) or date.today()
        title = f"{activity_type.replace('_', ' ').title()} logged"

        if activity_type == "harvest" and crop:
            title = f"Harvested {crop.get('crop_name')}"
        elif farm and farm.get("farm_name"):
            title = f"{activity_type.replace('_', ' ').title()} on {farm['farm_name']}"

        return {
            "type": "log_activity",
            "activity_type": activity_type,
            "farm_id": (farm or {}).get("id"),
            "farm_name": (farm or {}).get("farm_name"),
            "crop_name": (crop or {}).get("crop_name"),
            "date": activity_date,
            "title": title,
            "description": clause["text"].strip(),
        }
    return None


def _detect_expense(clause: dict[str, str], state: dict[str, Any]) -> Optional[dict[str, Any]]:
    normalized = clause["normalized"]
    if any(word in normalized for word in ["update", "change", "edit", "correct"]):
        return None
    if not any(word in normalized for word in ["spent", "paid", "bought", "purchased", "cost"]):
        return None

    amount = _extract_amount(normalized)
    category = _match_category(normalized, EXPENSE_CATEGORY_KEYWORDS, default="other")
    farm = _resolve_farm(state, normalized, allow_last_created=True)

    return {
        "type": "add_expense",
        "amount_inr": amount,
        "category": category,
        "farm_id": (farm or {}).get("id"),
        "farm_name": (farm or {}).get("farm_name"),
        "expense_date": _resolve_relative_date(normalized) or date.today(),
        "notes": clause["text"].strip(),
    }


def _detect_update_expense(clause: dict[str, str], state: dict[str, Any]) -> Optional[dict[str, Any]]:
    normalized = clause["normalized"]
    if not any(word in normalized for word in ["update", "change", "edit", "correct"]):
        return None
    if not any(word in normalized for word in ["expense", "spent", "paid", "cost", "purchase"]):
        return None

    amount = _extract_amount(normalized)
    category = _match_category(normalized, EXPENSE_CATEGORY_KEYWORDS, default="")
    farm = _resolve_farm(state, normalized, allow_last_created=True)
    expense_date = _resolve_relative_date(normalized)

    return {
        "type": "update_expense",
        "amount_inr": amount,
        "category": category or None,
        "farm_id": (farm or {}).get("id"),
        "expense_date": expense_date,
        "notes": clause["text"].strip(),
    }


def _detect_yield_sale(clause: dict[str, str], state: dict[str, Any]) -> Optional[dict[str, Any]]:
    normalized = clause["normalized"]
    if not any(word in normalized for word in ["harvest", "yield", "yielded", "sold", "sale", "price", "rate", "per kg", "/kg", "kg", "quintal"]):
        return None

    crop = _resolve_crop(state, normalized, allow_last_created=True)
    if not crop and not _extract_crop_name(normalized, state["ref_crops"]):
        return None

    yield_kg = _extract_yield_kg(normalized)
    sale_price_per_kg = _extract_sale_price_per_kg(normalized)
    if yield_kg is None and sale_price_per_kg is None and not any(word in normalized for word in ["sold", "sale", "yield", "yielded", "price", "rate"]):
        return None

    crop_name = (crop or {}).get("crop_name") or _extract_crop_name(normalized, state["ref_crops"])
    return {
        "type": "upsert_yield",
        "mode": "update" if any(word in normalized for word in ["update", "change", "edit", "correct"]) else "upsert",
        "crop_id": (crop or {}).get("id"),
        "crop_name": crop_name,
        "yield_kg": yield_kg,
        "sale_price_per_kg": sale_price_per_kg,
        "sale_date": _resolve_relative_date(normalized) or date.today(),
        "buyer_type": _match_buyer_type(normalized),
        "notes": clause["text"].strip(),
        "mark_harvested": any(word in normalized for word in ["harvest", "harvested", "sold", "sale"]),
    }


def _detect_crop_update(
    clause: dict[str, str],
    state: dict[str, Any],
    create_crop: Optional[dict[str, Any]],
) -> Optional[dict[str, Any]]:
    normalized = clause["normalized"]
    if create_crop:
        return None

    crop = _resolve_crop(state, normalized, allow_last_created=True)

    if any(word in normalized for word in ["mark as harvested", "mark it as harvested", "harvested"]):
        return {
            "type": "update_crop",
            "crop_id": (crop or {}).get("id"),
            "crop_name": (crop or {}).get("crop_name"),
            "status": "harvested",
            "growth_stage": "post_harvest",
            "actual_harvest_date": _resolve_relative_date(normalized) or date.today(),
            "source_text": clause["text"].strip(),
        }

    stage = _match_stage(normalized)
    if not stage:
        return None

    if not any(phrase in normalized for phrase in ["my crop", "my field", "crop is", "crop has", "plants are", "my ", "it is"]):
        return None

    return {
        "type": "update_crop",
        "crop_id": (crop or {}).get("id"),
        "crop_name": (crop or {}).get("crop_name"),
        "status": "active",
        "growth_stage": stage,
        "source_text": clause["text"].strip(),
    }


def _detect_help_request(clause: dict[str, str], state: dict[str, Any]) -> Optional[dict[str, Any]]:
    normalized = clause["normalized"]
    has_explicit_help_signal = any(cue in normalized for cue in HELP_REQUEST_CUES)
    has_category_signal = any(
        keyword in normalized
        for keywords in HELP_CATEGORY_KEYWORDS.values()
        for keyword in keywords
    )
    has_natural_help_signal = bool(state["groups"]) and (
        any(cue in normalized for cue in HELP_INTENT_WORDS)
        or (has_category_signal and any(word in normalized for word in ["need", "needed", "looking for", "require"]))
    )
    if not (has_explicit_help_signal or has_natural_help_signal):
        return None

    group = _resolve_group(state["groups"], normalized)
    category = _match_category(normalized, HELP_CATEGORY_KEYWORDS, default="advice_needed")
    urgency = "urgent" if any(word in normalized for word in ["urgent", "immediately", "asap", "today"]) else "normal"
    farm = _resolve_farm(state, normalized, allow_last_created=True)

    return {
        "type": "create_help_request",
        "group_id": (group or {}).get("id"),
        "group_name": (group or {}).get("name"),
        "farm_id": (farm or {}).get("id"),
        "category": category,
        "urgency": urgency,
        "title": _trim_sentence(clause["text"].strip(), 72),
        "description": clause["text"].strip(),
    }


def _detect_resource_share(clause: dict[str, str], state: dict[str, Any]) -> Optional[dict[str, Any]]:
    normalized = clause["normalized"]
    has_resource_keyword = any(keyword in normalized for keywords in RESOURCE_TYPE_KEYWORDS.values() for keyword in keywords)
    has_resource_signal = any(cue in normalized for cue in RESOURCE_CUES) or (
        bool(state["groups"])
        and any(word in normalized for word in RESOURCE_INTENT_WORDS)
        and has_resource_keyword
    ) or (
        any(word in normalized for word in ["available", "share", "offer", "lend"])
        and any(keyword in normalized for keywords in RESOURCE_TYPE_KEYWORDS.values() for keyword in keywords)
    )
    if not has_resource_signal:
        return None

    group = _resolve_group(state["groups"], normalized)
    resource_type = _match_category(normalized, RESOURCE_TYPE_KEYWORDS, default="other")
    title = _extract_resource_title(clause["text"], normalized, resource_type)
    if not title:
        return None

    quantity = _extract_quantity(normalized) or "1"
    availability_status = "in_use" if any(word in normalized for word in ["later", "busy", "in use"]) else "available"
    cost_per_use = _extract_cost_phrase(normalized)
    return {
        "type": "create_resource",
        "group_id": (group or {}).get("id"),
        "group_name": (group or {}).get("name"),
        "resource_type": resource_type,
        "title": title,
        "description": clause["text"].strip(),
        "availability_status": availability_status,
        "quantity": quantity,
        "cost_per_use": cost_per_use or "Free",
    }


def _detect_route_share(clause: dict[str, str], state: dict[str, Any]) -> Optional[dict[str, Any]]:
    normalized = clause["normalized"]
    has_route_signal = any(cue in normalized for cue in ROUTE_CUES) or (
        bool(state["groups"])
        and any(cue in normalized for cue in ROUTE_INTENT_WORDS)
        and any(word in normalized for word in ["market", "mandi", "transport", "warehouse", "storage", "supplier"])
    ) or (
        "trip" in normalized and any(word in normalized for word in ["market", "mandi", "transport", "share"])
    )
    if not has_route_signal:
        return None

    group = _resolve_group(state["groups"], normalized)
    destination_type = _match_category(normalized, ROUTE_DESTINATION_KEYWORDS, default="other")
    destination_name = _extract_destination_name(clause["text"], normalized)
    if not destination_name:
        return None

    frequency = _extract_frequency(normalized) or "On demand"
    route_name = f"{frequency} trip to {destination_name}"
    return {
        "type": "create_route",
        "group_id": (group or {}).get("id"),
        "group_name": (group or {}).get("name"),
        "route_name": route_name,
        "destination_type": destination_type,
        "destination_name": destination_name,
        "frequency": frequency,
        "notes": clause["text"].strip(),
    }


def _detect_ticket(clause: dict[str, str]) -> Optional[dict[str, Any]]:
    normalized = clause["normalized"]
    if not any(cue in normalized for cue in TICKET_CUES):
        return None

    category = _match_category(normalized, TICKET_CATEGORY_KEYWORDS, default="other")
    priority = "high" if any(word in normalized for word in ["urgent", "immediately", "critical"]) else "medium"
    return {
        "type": "create_ticket",
        "category": category,
        "priority": priority,
        "subject": _trim_sentence(clause["text"].strip(), 80),
        "description": clause["text"].strip(),
    }


def _execute_action(
    action: dict[str, Any],
    farmer_id: str,
    state: dict[str, Any],
    db: Client,
) -> dict[str, Any]:
    action_type = action["type"]
    if action_type == "create_farm":
        return _execute_create_farm(action, farmer_id, db)
    if action_type == "update_farm":
        return _execute_update_farm(action, farmer_id, db)
    if action_type == "create_crop":
        return _execute_create_crop(action, farmer_id, state, db)
    if action_type == "upsert_yield":
        return _execute_yield(action, farmer_id, state, db)
    if action_type == "log_activity":
        return _execute_activity(action, farmer_id, state, db)
    if action_type == "add_expense":
        return _execute_expense(action, farmer_id, state, db)
    if action_type == "update_expense":
        return _execute_update_expense(action, farmer_id, state, db)
    if action_type == "update_crop":
        return _execute_crop_update(action, farmer_id, state, db)
    if action_type == "create_ticket":
        return _execute_ticket(action, farmer_id, db)
    if action_type == "create_help_request":
        return _execute_help_request(action, farmer_id, state["groups"], db)
    if action_type == "create_resource":
        return _execute_resource_share(action, farmer_id, state["groups"], db)
    if action_type == "create_route":
        return _execute_route_share(action, farmer_id, state["groups"], db)
    return {"type": action_type, "status": "failed", "message": "Unsupported action."}


def _execute_create_farm(action: dict[str, Any], farmer_id: str, db: Client) -> dict[str, Any]:
    if not action.get("farm_name"):
        return {
            "type": "create_farm",
            "status": "needs_follow_up",
            "message": "I can create the farm after you tell me the farm name.",
        }

    existing = db.table("farms").select("*").eq("farmer_id", farmer_id).ilike("farm_name", action["farm_name"]).limit(1).execute()
    if existing.data:
        return {
            "type": "create_farm",
            "status": "skipped",
            "message": f"{existing.data[0].get('farm_name') or 'That farm'} already exists, so I did not create it again.",
            "refresh_targets": ["farms"],
            "record": existing.data[0],
        }

    payload = {
        "farmer_id": farmer_id,
        "farm_name": action["farm_name"],
        "area_acres": action.get("area_acres"),
        "soil_type": action.get("soil_type"),
        "irrigation_type": action.get("irrigation_type"),
        "latitude": None,
        "longitude": None,
    }
    result = db.table("farms").insert(payload).execute()
    if not result.data:
        return {"type": "create_farm", "status": "failed", "message": "I could not create that farm."}

    farm = result.data[0]
    detail_bits = []
    if farm.get("area_acres") is not None:
        detail_bits.append(f"{farm['area_acres']} acres")
    if farm.get("soil_type"):
        detail_bits.append(f"{farm['soil_type']} soil")
    if farm.get("irrigation_type"):
        detail_bits.append(f"{farm['irrigation_type']} irrigation")

    suffix = f" with {', '.join(detail_bits)}" if detail_bits else ""
    return {
        "type": "create_farm",
        "status": "success",
        "message": f"Created farm {farm.get('farm_name')}{suffix}.",
        "refresh_targets": ["farms", "dashboard"],
        "record_id": farm["id"],
        "record": farm,
    }


def _execute_update_farm(action: dict[str, Any], farmer_id: str, db: Client) -> dict[str, Any]:
    if not action.get("farm_id"):
        return {
            "type": "update_farm",
            "status": "needs_follow_up",
            "message": "I need the farm name to update those farm details.",
        }

    update_payload = {}
    if action.get("area_acres") is not None:
        update_payload["area_acres"] = action["area_acres"]
    if action.get("soil_type"):
        update_payload["soil_type"] = action["soil_type"]
    if action.get("irrigation_type"):
        update_payload["irrigation_type"] = action["irrigation_type"]
    if not update_payload:
        return {"type": "update_farm", "status": "failed", "message": "I could not find any farm details to update."}

    result = db.table("farms").update(update_payload).eq("id", action["farm_id"]).eq("farmer_id", farmer_id).execute()
    if not result.data:
        return {"type": "update_farm", "status": "failed", "message": "I could not update that farm."}

    return {
        "type": "update_farm",
        "status": "success",
        "message": f"Updated {action.get('farm_name') or 'that farm'} details.",
        "refresh_targets": ["farms", "dashboard"],
        "record_id": action["farm_id"],
        "record": result.data[0],
    }


def _execute_create_crop(action: dict[str, Any], farmer_id: str, state: dict[str, Any], db: Client) -> dict[str, Any]:
    if not action.get("crop_name"):
        return {
            "type": "create_crop",
            "status": "needs_follow_up",
            "message": "I can add the crop after you tell me which crop you planted.",
        }

    farm_id = action.get("farm_id")
    farm_name = action.get("farm_name")
    if not farm_id:
        candidate_farm = _resolve_farm(state, "", allow_last_created=True)
        if candidate_farm:
            farm_id = candidate_farm.get("id")
            farm_name = candidate_farm.get("farm_name")

    if not farm_id:
        return {
            "type": "create_crop",
            "status": "needs_follow_up",
            "message": "I need the farm name before I can add that crop record.",
        }

    existing = (
        db.table("crop_records")
        .select("*")
        .eq("farmer_id", farmer_id)
        .eq("farm_id", farm_id)
        .ilike("crop_name", action["crop_name"])
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    if existing.data:
        return {
            "type": "create_crop",
            "status": "skipped",
            "message": f"{action['crop_name']} is already active on {farm_name or 'that farm'}, so I did not add it twice.",
            "refresh_targets": ["farms"],
            "record": existing.data[0],
        }

    payload = {
        "farm_id": farm_id,
        "farmer_id": farmer_id,
        "crop_name": action["crop_name"],
        "season": action["season"],
        "sowing_date": action["sowing_date"].isoformat(),
        "growth_stage": action["growth_stage"],
        "status": "active",
    }
    result = db.table("crop_records").insert(payload).execute()
    if not result.data:
        return {"type": "create_crop", "status": "failed", "message": "I could not create that crop record."}

    crop = result.data[0]
    _create_activity_if_missing(
        db=db,
        farmer_id=farmer_id,
        farm_id=farm_id,
        crop_name=action["crop_name"],
        activity_type="planting",
        title=f"{action['crop_name']} Planted",
        description=action.get("notes") or f"Planted {action['crop_name']} on {farm_name or 'the selected farm'}.",
        activity_date=action["sowing_date"],
    )

    return {
        "type": "create_crop",
        "status": "success",
        "message": f"Added {action['crop_name']} to {farm_name or 'the selected farm'} and logged the planting.",
        "refresh_targets": ["farms", "activity", "dashboard"],
        "record_id": crop["id"],
        "record": crop,
    }


def _execute_activity(action: dict[str, Any], farmer_id: str, state: dict[str, Any], db: Client) -> dict[str, Any]:
    farm_id = action.get("farm_id")
    farm_name = action.get("farm_name")
    if not farm_id:
        farm = _resolve_farm(state, "", allow_last_created=True)
        if farm:
            farm_id = farm.get("id")
            farm_name = farm.get("farm_name")

    existing = (
        db.table("activity_logs")
        .select("*")
        .eq("farmer_id", farmer_id)
        .eq("activity_type", action["activity_type"])
        .eq("date", action["date"].isoformat())
        .eq("title", action["title"])
        .gte("created_at", (datetime.utcnow() - timedelta(minutes=10)).isoformat())
        .limit(1)
        .execute()
    )
    if existing.data:
        return {
            "type": "log_activity",
            "status": "skipped",
            "message": f"I already logged that {action['activity_type'].replace('_', ' ')} just now, so I did not duplicate it.",
            "refresh_targets": ["activity"],
            "record": existing.data[0],
        }

    payload = {
        "farmer_id": farmer_id,
        "farm_id": farm_id,
        "crop_name": action.get("crop_name"),
        "activity_type": action["activity_type"],
        "title": action["title"],
        "description": action.get("description"),
        "date": action["date"].isoformat(),
    }
    result = db.table("activity_logs").insert(payload).execute()
    if not result.data:
        return {"type": "log_activity", "status": "failed", "message": "I could not log that activity."}

    where_text = f" for {farm_name}" if farm_name else ""
    crop_text = f" on {action['crop_name']}" if action.get("crop_name") else ""
    return {
        "type": "log_activity",
        "status": "success",
        "message": f"Logged {action['activity_type'].replace('_', ' ')}{crop_text}{where_text}.",
        "refresh_targets": ["activity", "dashboard"],
        "record_id": result.data[0]["id"],
        "record": result.data[0],
    }


def _execute_expense(action: dict[str, Any], farmer_id: str, state: dict[str, Any], db: Client) -> dict[str, Any]:
    amount = action.get("amount_inr")
    if amount is None:
        return {
            "type": "add_expense",
            "status": "needs_follow_up",
            "message": "I can log that expense after you tell me the amount spent in rupees.",
        }

    farm_id = action.get("farm_id")
    if not farm_id:
        farm = _resolve_farm(state, "", allow_last_created=True)
        if farm:
            farm_id = farm.get("id")

    existing = (
        db.table("expense_logs")
        .select("*")
        .eq("farmer_id", farmer_id)
        .eq("category", action["category"])
        .eq("amount_inr", amount)
        .eq("expense_date", action["expense_date"].isoformat())
        .gte("created_at", (datetime.utcnow() - timedelta(minutes=10)).isoformat())
        .limit(1)
        .execute()
    )
    if existing.data:
        return {
            "type": "add_expense",
            "status": "skipped",
            "message": "I already logged that expense just now, so I did not duplicate it.",
            "refresh_targets": ["finance"],
            "record": existing.data[0],
        }

    payload = {
        "farmer_id": farmer_id,
        "farm_id": farm_id,
        "crop_record_id": None,
        "category": action["category"],
        "amount_inr": amount,
        "expense_date": action["expense_date"].isoformat(),
        "notes": action.get("notes"),
    }
    result = db.table("expense_logs").insert(payload).execute()
    if not result.data:
        return {"type": "add_expense", "status": "failed", "message": "I could not save that expense."}

    return {
        "type": "add_expense",
        "status": "success",
        "message": f"Logged an expense of Rs. {amount:.0f} under {action['category'].replace('_', ' ')}.",
        "refresh_targets": ["finance", "dashboard"],
        "record_id": result.data[0]["id"],
        "record": result.data[0],
    }


def _execute_update_expense(action: dict[str, Any], farmer_id: str, state: dict[str, Any], db: Client) -> dict[str, Any]:
    amount = action.get("amount_inr")
    if amount is None:
        return {
            "type": "update_expense",
            "status": "needs_follow_up",
            "message": "Tell me the corrected expense amount in rupees and I will update it.",
        }

    expense = _find_matching_expense(state, action)
    if not expense:
        return {
            "type": "update_expense",
            "status": "needs_follow_up",
            "message": "I could not identify which expense to update. Tell me the category, farm, or date.",
        }

    result = (
        db.table("expense_logs")
        .update({"amount_inr": amount, "notes": action.get("notes") or expense.get("notes")})
        .eq("id", expense["id"])
        .eq("farmer_id", farmer_id)
        .execute()
    )
    if not result.data:
        return {"type": "update_expense", "status": "failed", "message": "I could not update that expense."}

    category = (result.data[0].get("category") or "expense").replace("_", " ")
    return {
        "type": "update_expense",
        "status": "success",
        "message": f"Updated the {category} expense to Rs. {amount:.0f}.",
        "refresh_targets": ["finance", "dashboard"],
        "record_id": expense["id"],
        "record": result.data[0],
    }


def _execute_yield(action: dict[str, Any], farmer_id: str, state: dict[str, Any], db: Client) -> dict[str, Any]:
    crop = None
    if action.get("crop_id"):
        crop = next((item for item in state["context"]["crops"] if item.get("id") == action["crop_id"]), None)
    if not crop:
        crop = _resolve_crop(state, _normalize(action.get("crop_name")), allow_last_created=True)
    if not crop:
        return {
            "type": "upsert_yield",
            "status": "needs_follow_up",
            "message": "I need the crop name before I can log or edit the harvest sale details.",
        }

    existing = next((item for item in state["context"]["yields"] if item.get("crop_record_id") == crop.get("id")), None)
    update_payload: dict[str, Any] = {}
    if action.get("yield_kg") is not None:
        update_payload["yield_kg"] = action["yield_kg"]
    if action.get("sale_price_per_kg") is not None:
        update_payload["sale_price_per_kg"] = action["sale_price_per_kg"]
    if action.get("sale_date"):
        update_payload["sale_date"] = action["sale_date"].isoformat()
    if action.get("buyer_type"):
        update_payload["buyer_type"] = action["buyer_type"]
    if action.get("notes"):
        update_payload["notes"] = action["notes"]

    if not update_payload and not action.get("mark_harvested"):
        return {
            "type": "upsert_yield",
            "status": "needs_follow_up",
            "message": "Tell me the harvest quantity, sale price, or selling date and I will record it.",
        }

    if existing:
        if update_payload:
            result = (
                db.table("yield_records")
                .update(update_payload)
                .eq("id", existing["id"])
                .eq("farmer_id", farmer_id)
                .execute()
            )
            if not result.data:
                return {"type": "upsert_yield", "status": "failed", "message": "I could not update that harvest sale entry."}
            yield_record = result.data[0]
            message = f"Updated the harvest sale details for {crop.get('crop_name') or 'that crop'}."
        else:
            yield_record = existing
            message = f"Marked {crop.get('crop_name') or 'that crop'} as harvested."
    else:
        if not update_payload:
            return {
                "type": "upsert_yield",
                "status": "skipped",
                "message": f"I marked {crop.get('crop_name') or 'that crop'} as harvested. Add quantity or sale price when you have it.",
                "refresh_targets": ["farms", "dashboard", "activity"],
                "record": None,
                "crop_record": {
                    **crop,
                    "status": "harvested",
                    "growth_stage": "post_harvest",
                    "actual_harvest_date": (action.get('sale_date') or date.today()).isoformat(),
                },
            }
        payload = {
            "crop_record_id": crop["id"],
            "farmer_id": farmer_id,
            "yield_kg": action.get("yield_kg"),
            "sale_price_per_kg": action.get("sale_price_per_kg"),
            "sale_date": action.get("sale_date").isoformat() if action.get("sale_date") else None,
            "buyer_type": action.get("buyer_type"),
            "notes": action.get("notes"),
        }
        result = db.table("yield_records").insert(payload).execute()
        if not result.data:
            return {"type": "upsert_yield", "status": "failed", "message": "I could not save that harvest sale entry."}
        yield_record = result.data[0]
        message = f"Logged harvest and sale details for {crop.get('crop_name') or 'that crop'}."

    if action.get("mark_harvested"):
        crop_update_payload = {
            "status": "harvested",
            "growth_stage": "post_harvest",
            "actual_harvest_date": (action.get("sale_date") or date.today()).isoformat(),
        }
        db.table("crop_records").update(crop_update_payload).eq("id", crop["id"]).eq("farmer_id", farmer_id).execute()
        _create_activity_if_missing(
            db=db,
            farmer_id=farmer_id,
            farm_id=crop.get("farm_id"),
            crop_name=crop.get("crop_name"),
            activity_type="harvest",
            title=f"Harvested {crop.get('crop_name')}",
            description=action.get("notes") or f"Harvest updated for {crop.get('crop_name')}.",
            activity_date=action.get("sale_date") or date.today(),
        )

    return {
        "type": "upsert_yield",
        "status": "success",
        "message": message,
        "refresh_targets": ["finance", "dashboard", "farms", "activity"],
        "record_id": yield_record["id"],
        "record": yield_record,
        "crop_record": {
            **crop,
            "status": "harvested" if action.get("mark_harvested") else crop.get("status"),
            "growth_stage": "post_harvest" if action.get("mark_harvested") else crop.get("growth_stage"),
            "actual_harvest_date": (action.get("sale_date") or date.today()).isoformat() if action.get("mark_harvested") else crop.get("actual_harvest_date"),
        },
    }


def _execute_crop_update(action: dict[str, Any], farmer_id: str, state: dict[str, Any], db: Client) -> dict[str, Any]:
    crop = None
    if action.get("crop_id"):
        crop = next((item for item in state["context"]["crops"] if item.get("id") == action["crop_id"]), None)
    if not crop:
        crop = _resolve_crop(state, "", allow_last_created=True)
    if not crop:
        return {
            "type": "update_crop",
            "status": "needs_follow_up",
            "message": "I found more than one crop or none at all. Tell me which crop or farm you want me to update.",
        }

    update_payload = {}
    if action.get("status"):
        update_payload["status"] = action["status"]
    if action.get("growth_stage"):
        update_payload["growth_stage"] = action["growth_stage"]
    if action.get("actual_harvest_date"):
        update_payload["actual_harvest_date"] = action["actual_harvest_date"].isoformat()

    already_same = True
    for key, value in update_payload.items():
        if crop.get(key) != value:
            already_same = False
            break
    if already_same:
        return {
            "type": "update_crop",
            "status": "skipped",
            "message": f"{crop.get('crop_name') or 'That crop'} already has those details, so I left it unchanged.",
            "refresh_targets": ["farms"],
            "record": crop,
        }

    result = db.table("crop_records").update(update_payload).eq("id", crop["id"]).eq("farmer_id", farmer_id).execute()
    if not result.data:
        return {"type": "update_crop", "status": "failed", "message": "I could not update that crop record."}

    if action.get("status") == "harvested":
        message = f"Updated {crop.get('crop_name') or 'your crop'} as harvested."
    else:
        message = f"Updated {crop.get('crop_name') or 'your crop'} to {action.get('growth_stage', 'the latest stage').replace('_', ' ')}."

    return {
        "type": "update_crop",
        "status": "success",
        "message": message,
        "refresh_targets": ["farms", "dashboard", "activity"],
        "record_id": crop["id"],
        "record": result.data[0],
    }


def _execute_ticket(action: dict[str, Any], farmer_id: str, db: Client) -> dict[str, Any]:
    existing = (
        db.table("farmer_tickets")
        .select("*")
        .eq("farmer_id", farmer_id)
        .eq("subject", action["subject"])
        .neq("status", "closed")
        .gte("created_at", (datetime.utcnow() - timedelta(minutes=10)).isoformat())
        .limit(1)
        .execute()
    )
    if existing.data:
        return {
            "type": "create_ticket",
            "status": "skipped",
            "message": "That support ticket already exists, so I did not raise it again.",
            "refresh_targets": ["tickets"],
            "record": existing.data[0],
        }

    payload = {
        "farmer_id": farmer_id,
        "category": action["category"],
        "priority": action["priority"],
        "subject": action["subject"],
        "description": action["description"],
        "status": "open",
    }
    result = db.table("farmer_tickets").insert(payload).execute()
    if not result.data:
        return {"type": "create_ticket", "status": "failed", "message": "I could not raise that support ticket."}

    ticket_id = result.data[0]["id"]
    create_notifications_for_admins(
        db,
        title="New farmer support ticket",
        message=action["subject"],
        notification_type="admin_ticket",
        action_url=f"/admin/tickets/{ticket_id}",
        metadata={"ticket_id": ticket_id, "farmer_id": farmer_id},
    )
    create_notification(
        db,
        farmer_id=farmer_id,
        title="Support ticket created",
        message="Your support ticket has been created and sent to the KVK/admin team.",
        notification_type="ticket",
        action_url=f"/tickets/{ticket_id}",
        metadata={"ticket_id": ticket_id},
    )

    return {
        "type": "create_ticket",
        "status": "success",
        "message": "Created a support ticket and sent it to the KVK/admin team.",
        "refresh_targets": ["tickets", "notifications", "dashboard"],
        "record_id": ticket_id,
        "record": result.data[0],
    }


def _get_farmer_display_name(db: Client, farmer_id: str) -> str:
    farmer = db.table("farmers").select("full_name").eq("id", farmer_id).single().execute()
    return (farmer.data or {}).get("full_name") or "A member"


def _post_group_message(db: Client, group_id: str, farmer_id: str, message: str, message_type: str) -> None:
    db.table("group_messages").insert({
        "group_id": group_id,
        "farmer_id": farmer_id,
        "message": message,
        "message_type": message_type,
    }).execute()


def _group_event_type() -> str:
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


def _execute_help_request(action: dict[str, Any], farmer_id: str, groups: list[dict[str, Any]], db: Client) -> dict[str, Any]:
    group_id = action.get("group_id")
    group_name = action.get("group_name")
    if not group_id:
        if len(groups) == 1:
            group_id = groups[0]["id"]
            group_name = groups[0]["name"]
        else:
            return {
                "type": "create_help_request",
                "status": "needs_follow_up",
                "message": "I can post that help request after you tell me which SakhiNet group to use.",
            }

    existing = (
        db.table("help_requests")
        .select("*")
        .eq("group_id", group_id)
        .eq("farmer_id", farmer_id)
        .eq("title", action["title"])
        .eq("status", "open")
        .gte("created_at", (datetime.utcnow() - timedelta(minutes=10)).isoformat())
        .limit(1)
        .execute()
    )
    if existing.data:
        return {
            "type": "create_help_request",
            "status": "skipped",
            "message": "That help request is already live, so I did not post it twice.",
            "refresh_targets": ["community"],
            "record": existing.data[0],
        }

    payload = {
        "group_id": group_id,
        "farmer_id": farmer_id,
        "category": action["category"],
        "title": action["title"],
        "description": action["description"],
        "urgency": action["urgency"],
        "status": "open",
        "expires_at": (date.today() + timedelta(days=7)).isoformat(),
    }
    result = db.table("help_requests").insert(payload).execute()
    if not result.data:
        return {"type": "create_help_request", "status": "failed", "message": "I could not post that help request."}

    request_id = result.data[0]["id"]
    actor_name = _get_farmer_display_name(db, farmer_id)
    _post_group_message(
        db,
        group_id,
        farmer_id,
        f"{actor_name} posted a help request: {action['title']}.",
        _group_event_type(),
    )
    create_notifications_for_group_members(
        db,
        group_id=group_id,
        exclude_farmer_id=farmer_id,
        title="New SakhiNet help request",
        message=action["title"],
        notification_type="community",
        action_url=f"/community/groups/{group_id}",
        metadata={"request_id": request_id, "group_id": group_id},
    )
    create_notification(
        db,
        farmer_id=farmer_id,
        title="Help request posted",
        message=f"Your request is now live in {group_name or 'your group'}.",
        notification_type="community",
        action_url=f"/community/groups/{group_id}",
        metadata={"request_id": request_id, "group_id": group_id},
    )

    return {
        "type": "create_help_request",
        "status": "success",
        "message": f"Posted your help request in {group_name or 'the selected group'}.",
        "refresh_targets": ["community", "notifications"],
        "record_id": request_id,
        "record": result.data[0],
    }


def _execute_resource_share(action: dict[str, Any], farmer_id: str, groups: list[dict[str, Any]], db: Client) -> dict[str, Any]:
    group_id = action.get("group_id")
    group_name = action.get("group_name")
    if not group_id:
        if len(groups) == 1:
            group_id = groups[0]["id"]
            group_name = groups[0]["name"]
        else:
            return {
                "type": "create_resource",
                "status": "needs_follow_up",
                "message": "I can share that resource after you tell me which SakhiNet group to post it in.",
            }

    existing = (
        db.table("shared_resources")
        .select("*")
        .eq("group_id", group_id)
        .eq("farmer_id", farmer_id)
        .eq("title", action["title"])
        .gte("created_at", (datetime.utcnow() - timedelta(minutes=10)).isoformat())
        .limit(1)
        .execute()
    )
    if existing.data:
        return {
            "type": "create_resource",
            "status": "skipped",
            "message": "That resource is already shared in the group, so I did not post it twice.",
            "refresh_targets": ["community"],
            "record": existing.data[0],
        }

    payload = {
        "group_id": group_id,
        "farmer_id": farmer_id,
        "resource_type": _normalize_resource_type(action["resource_type"]),
        "title": action["title"],
        "description": action["description"],
        "availability_status": action["availability_status"],
        "quantity": action["quantity"],
        "cost_per_use": action["cost_per_use"],
    }
    result = db.table("shared_resources").insert(payload).execute()
    if not result.data:
        return {"type": "create_resource", "status": "failed", "message": "I could not share that resource."}

    actor_name = _get_farmer_display_name(db, farmer_id)
    _post_group_message(
        db,
        group_id,
        farmer_id,
        f"{actor_name} shared a resource: {action['title']}.",
        _group_event_type(),
    )
    create_notifications_for_group_members(
        db,
        group_id=group_id,
        exclude_farmer_id=farmer_id,
        title="New SakhiNet resource shared",
        message=action["title"],
        notification_type="community",
        action_url=f"/community/groups/{group_id}",
        metadata={"resource_id": result.data[0]["id"], "group_id": group_id},
    )
    return {
        "type": "create_resource",
        "status": "success",
        "message": f"Shared {action['title']} in {group_name or 'your group'}.",
        "refresh_targets": ["community", "notifications"],
        "record_id": result.data[0]["id"],
        "record": result.data[0],
    }


def _execute_route_share(action: dict[str, Any], farmer_id: str, groups: list[dict[str, Any]], db: Client) -> dict[str, Any]:
    group_id = action.get("group_id")
    group_name = action.get("group_name")
    if not group_id:
        if len(groups) == 1:
            group_id = groups[0]["id"]
            group_name = groups[0]["name"]
        else:
            return {
                "type": "create_route",
                "status": "needs_follow_up",
                "message": "I can add that route after you tell me which SakhiNet group should receive it.",
            }

    existing = (
        db.table("common_routes")
        .select("*")
        .eq("group_id", group_id)
        .eq("route_name", action["route_name"])
        .gte("created_at", (datetime.utcnow() - timedelta(minutes=10)).isoformat())
        .limit(1)
        .execute()
    )
    if existing.data:
        return {
            "type": "create_route",
            "status": "skipped",
            "message": "That shared route already exists, so I did not add it again.",
            "refresh_targets": ["community"],
            "record": existing.data[0],
        }

    payload = {
        "group_id": group_id,
        "created_by": farmer_id,
        "route_name": action["route_name"],
        "destination_type": _normalize_route_destination_type(action["destination_type"]),
        "destination_name": action["destination_name"],
        "frequency": action["frequency"],
        "notes": action["notes"],
    }
    result = db.table("common_routes").insert(payload).execute()
    if not result.data:
        return {"type": "create_route", "status": "failed", "message": "I could not add that shared route."}

    actor_name = _get_farmer_display_name(db, farmer_id)
    _post_group_message(
        db,
        group_id,
        farmer_id,
        f"{actor_name} shared a route: {action['route_name']}.",
        _group_event_type(),
    )
    create_notifications_for_group_members(
        db,
        group_id=group_id,
        exclude_farmer_id=farmer_id,
        title="New SakhiNet shared route",
        message=action["route_name"],
        notification_type="community",
        action_url=f"/community/groups/{group_id}",
        metadata={"route_id": result.data[0]["id"], "group_id": group_id},
    )
    return {
        "type": "create_route",
        "status": "success",
        "message": f"Added the route '{action['route_name']}' in {group_name or 'your group'}.",
        "refresh_targets": ["community", "notifications"],
        "record_id": result.data[0]["id"],
        "record": result.data[0],
    }


def _apply_action_result_to_state(action: dict[str, Any], result: dict[str, Any], state: dict[str, Any], farmer_id: str):
    record = result.get("record")
    if result.get("status") not in {"success", "skipped"} or not record:
        return

    if action["type"] in {"create_farm", "update_farm"}:
        state["last_created_farm"] = record
        farms = state["context"]["farms"]
        _upsert_record(farms, record)
        return

    if action["type"] in {"create_crop", "update_crop"}:
        state["last_created_crop"] = record
        crops = state["context"]["crops"]
        _upsert_record(crops, record)
        return

    if action["type"] in {"add_expense", "update_expense"}:
        _upsert_record(state["context"]["expenses"], record)
        return

    if action["type"] == "upsert_yield":
        _upsert_record(state["context"]["yields"], record)
        crop_record = result.get("crop_record")
        if crop_record:
            state["last_created_crop"] = crop_record
            _upsert_record(state["context"]["crops"], crop_record)
        return

    if action["type"] == "log_activity" and action.get("farm_id") and not state.get("last_created_farm"):
        farm = next((item for item in state["context"]["farms"] if item.get("id") == action["farm_id"]), None)
        if farm:
            state["last_created_farm"] = farm
    if action["type"] in {"create_resource", "create_route", "create_help_request"}:
        return


def _upsert_record(records: list[dict[str, Any]], record: dict[str, Any]):
    for index, existing in enumerate(records):
        if existing.get("id") == record.get("id"):
            records[index] = {**existing, **record}
            return
    records.append(record)


def _create_activity_if_missing(
    db: Client,
    farmer_id: str,
    farm_id: str,
    crop_name: str,
    activity_type: str,
    title: str,
    description: str,
    activity_date: date,
):
    existing = (
        db.table("activity_logs")
        .select("id")
        .eq("farmer_id", farmer_id)
        .eq("farm_id", farm_id)
        .eq("activity_type", activity_type)
        .eq("date", activity_date.isoformat())
        .eq("title", title)
        .limit(1)
        .execute()
    )
    if existing.data:
        return

    db.table("activity_logs").insert({
        "farmer_id": farmer_id,
        "farm_id": farm_id,
        "crop_name": crop_name,
        "activity_type": activity_type,
        "title": title,
        "description": description,
        "date": activity_date.isoformat(),
    }).execute()


def _load_farmer_groups(db: Client, farmer_id: str) -> list[dict[str, Any]]:
    memberships = (
        db.table("cooperative_memberships")
        .select("cooperative_groups(id, name)")
        .eq("farmer_id", farmer_id)
        .execute()
    )
    groups = []
    for row in memberships.data or []:
        group = row.get("cooperative_groups")
        if group and group.get("id"):
            groups.append(group)
    return groups


def _load_reference_crop_names(db: Client) -> list[str]:
    try:
        crops = db.table("ref_crops").select("crop_name_en").limit(500).execute()
        names = [row["crop_name_en"] for row in (crops.data or []) if row.get("crop_name_en")]
        return sorted(set(names), key=len, reverse=True)
    except Exception:
        return []


def _find_matching_expense(state: dict[str, Any], action: dict[str, Any]) -> Optional[dict[str, Any]]:
    expenses = list(state["context"].get("expenses", []))
    expenses.sort(key=lambda item: item.get("created_at") or "", reverse=True)

    filtered = expenses
    if action.get("category"):
        filtered = [item for item in filtered if item.get("category") == action["category"]]
    if action.get("farm_id"):
        filtered = [item for item in filtered if item.get("farm_id") == action["farm_id"]]
    if action.get("expense_date"):
        iso_date = action["expense_date"].isoformat()
        filtered = [item for item in filtered if item.get("expense_date") == iso_date]

    if filtered:
        return filtered[0]
    if "last" in _normalize(action.get("notes")) and expenses:
        return expenses[0]
    if len(expenses) == 1:
        return expenses[0]
    return None


def _resolve_farm(state: dict[str, Any], normalized: str, allow_last_created: bool = False) -> Optional[dict[str, Any]]:
    farms = state["context"]["farms"]
    for farm in farms:
        farm_name = _normalize(farm.get("farm_name"))
        if farm_name and farm_name in normalized:
            return farm
    if allow_last_created and state.get("last_created_farm"):
        wrapped = f" {normalized} "
        if any(token in wrapped for token in [" it ", " there ", " this farm", " that farm", " this field", " that field", " on it", " in it"]) or normalized in {"it", "there", "this farm", "that farm", ""}:
            return state["last_created_farm"]
    if len(farms) == 1:
        return farms[0]
    return None


def _resolve_crop(
    state: dict[str, Any],
    normalized: str,
    farm_id: Optional[str] = None,
    allow_last_created: bool = False,
) -> Optional[dict[str, Any]]:
    crops = state["context"]["crops"]
    filtered = [crop for crop in crops if not farm_id or crop.get("farm_id") == farm_id]
    for crop in filtered:
        crop_name = _normalize(crop.get("crop_name"))
        if crop_name and crop_name in normalized:
            return crop
    if allow_last_created and state.get("last_created_crop"):
        wrapped = f" {normalized} "
        if any(token in wrapped for token in [" it ", " this crop", " that crop"]) or normalized in {"it", "this crop", "that crop", ""}:
            return state["last_created_crop"]
    active = [crop for crop in filtered if crop.get("status") == "active"]
    if len(active) == 1:
        return active[0]
    return None


def _match_buyer_type(normalized: str) -> Optional[str]:
    for buyer_type, keywords in BUYER_TYPE_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            return buyer_type
    return None


def _resolve_group(groups: list[dict[str, Any]], normalized: str) -> Optional[dict[str, Any]]:
    for group in groups:
        group_name = _normalize(group.get("name"))
        if group_name and group_name in normalized:
            return group
    if len(groups) == 1:
        return groups[0]
    return None


def _split_into_clauses(text: str) -> list[str]:
    working = " " + re.sub(r"\s+", " ", text.strip()) + " "
    starters = sorted(set(CLAUSE_STARTERS), key=len, reverse=True)
    for starter in starters:
        pattern = re.compile(
            rf"\s+(?:and|then|also|plus|after that|afterwards)\s+(?=(?:i\s+)?{re.escape(starter.strip())})",
            flags=re.IGNORECASE,
        )
        working = pattern.sub(" ||| ", working)
    working = re.sub(r"[;]+", " ||| ", working)
    working = re.sub(r"\.\s+", " ||| ", working)
    clauses = [chunk.strip(" ,") for chunk in working.split("|||")]
    return [clause for clause in clauses if clause]


def _action_signature(action: dict[str, Any]) -> str:
    relevant = {k: v for k, v in action.items() if k not in {"source_text", "description", "notes"}}
    normalized_items = []
    for key in sorted(relevant):
        value = relevant[key]
        if isinstance(value, date):
            value = value.isoformat()
        normalized_items.append(f"{key}={value}")
    return f"{action['type']}|" + "|".join(normalized_items)


def _extract_farm_name_from_clause(text: str, normalized: str) -> Optional[str]:
    patterns = [
        r"(?:called|named)\s+([a-z0-9][a-z0-9\s\-]{1,50}?)(?=\s+(?:with|of|having|in|at|for|on|and|then)\b|$)",
        r"(?:new|create|add|setup|set up)\s+(?:a\s+)?farm\s+([a-z0-9][a-z0-9\s\-]{1,50}?)(?=\s+(?:with|of|having|in|at|for|on|and|then)\b|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, normalized)
        if match:
            return _smart_title(match.group(1))

    farm_match = re.search(r"farm\s+([a-z0-9][a-z0-9\s\-]{1,40})", text, flags=re.IGNORECASE)
    if farm_match and farm_match.group(1).strip():
        candidate = farm_match.group(1).strip()
        if candidate.lower() not in {"with", "of", "for"}:
            return _smart_title(candidate)
    return None


def _extract_crop_name(normalized: str, ref_crops: list[str]) -> Optional[str]:
    for crop_name in ref_crops:
        crop_norm = _normalize(crop_name)
        if crop_norm and crop_norm in normalized:
            return crop_name
    return None


def _extract_crop_name_from_pattern(text: str, normalized: str) -> Optional[str]:
    patterns = [
        r"(?:plant|planted|sow|sowed|seeded|add crop|create crop)\s+([a-z][a-z\s\-]{1,30}?)(?=\s+(?:on|in|at|for|today|yesterday|tomorrow|this|with|and|then)\b|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, normalized)
        if match:
            return _smart_title(match.group(1))
    return None


def _extract_resource_title(text: str, normalized: str, resource_type: str) -> Optional[str]:
    patterns = [
        r"(?:share|offer|add)\s+(?:my\s+)?([a-z0-9][a-z0-9\s\-]{1,40}?)(?=\s+(?:for|to|in|on|with|and|group)\b|$)",
        r"my\s+([a-z0-9][a-z0-9\s\-]{1,40}?)\s+is\s+available",
    ]
    for pattern in patterns:
        match = re.search(pattern, normalized)
        if match:
            return _smart_title(match.group(1))

    fallback = {
        "equipment": "Shared Equipment",
        "seeds": "Shared Inputs",
        "vehicle": "Shared Vehicle",
        "land": "Shared Storage Space",
        "other": "Shared Resource",
    }
    return fallback.get(resource_type)


def _extract_destination_name(text: str, normalized: str) -> Optional[str]:
    patterns = [
        r"(?:to|for)\s+([a-z0-9][a-z0-9\s\-]{1,40}?)(?=\s+(?:every|weekly|daily|market day|tomorrow|today|group)\b|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, normalized)
        if match:
            return _smart_title(match.group(1))
    if "mandi" in normalized:
        return "Mandi"
    if "market" in normalized:
        return "Market"
    return None


def _extract_frequency(normalized: str) -> Optional[str]:
    if "daily" in normalized or "every day" in normalized:
        return "Daily"
    if "weekly" in normalized or "every week" in normalized:
        return "Weekly"
    if "market day" in normalized:
        return "Market day"
    if "on demand" in normalized:
        return "On demand"
    return None


def _extract_area_acres(normalized: str) -> Optional[float]:
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:acre|acres)", normalized)
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def _extract_quantity(normalized: str) -> Optional[str]:
    match = re.search(r"(\d+)\s*(?:people|person|workers|worker|items|item|bags|bag|seats|seat|units|unit)?", normalized)
    if not match:
        return None
    return match.group(1)


def _extract_soil_type(normalized: str) -> Optional[str]:
    for soil_type in SOIL_TYPES:
        if soil_type in normalized:
            return soil_type
    return None


def _extract_irrigation_type(normalized: str) -> Optional[str]:
    for irrigation_type in IRRIGATION_TYPES:
        if irrigation_type in normalized:
            return irrigation_type
    return None


def _extract_season(normalized: str) -> Optional[str]:
    for season in SEASONS:
        if season in normalized:
            return season
    return None


def _infer_season_for_date(value: date) -> str:
    month = value.month
    if month in {6, 7, 8, 9, 10}:
        return "kharif"
    if month in {11, 12, 1, 2}:
        return "rabi"
    return "zaid"


def _resolve_relative_date(normalized: str) -> Optional[date]:
    today = date.today()
    if "day before yesterday" in normalized:
        return today - timedelta(days=2)
    if "yesterday" in normalized:
        return today - timedelta(days=1)
    if "today" in normalized:
        return today
    if "tomorrow" in normalized:
        return today + timedelta(days=1)
    return None


def _extract_amount(normalized: str) -> Optional[float]:
    match = re.search(r"(?:rs\.?|rupees|inr|₹)?\s*(\d{2,7}(?:,\d{3})*(?:\.\d{1,2})?)", normalized)
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", ""))
    except ValueError:
        return None


def _extract_cost_phrase(normalized: str) -> Optional[str]:
    if "fuel only" in normalized:
        return "Fuel only"
    if "free" in normalized:
        return "Free"
    amount = _extract_amount(normalized)
    if amount is not None:
        return f"Rs. {amount:.0f} per use"
    return None


def _extract_yield_kg(normalized: str) -> Optional[float]:
    match = re.search(r"(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms|quintal|quintals|qtl|qtls)", normalized)
    if not match:
        return None
    value = float(match.group(1))
    unit = match.group(2)
    if unit in {"quintal", "quintals", "qtl", "qtls"}:
        return value * 100
    return value


def _extract_sale_price_per_kg(normalized: str) -> Optional[float]:
    patterns = [
        r"(?:price|rate|sold at|at|for)\s*(?:rs\.?|rupees|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:per\s*(?:kg|kilogram)|/\s*kg)?",
        r"(?:rs\.?|rupees|inr|₹)\s*(\d+(?:\.\d+)?)\s*(?:per\s*(?:kg|kilogram)|/\s*kg)",
    ]
    for pattern in patterns:
        match = re.search(pattern, normalized)
        if match:
            return float(match.group(1))
    return None


def _match_category(normalized: str, mapping: dict[str, list[str]], default: str) -> str:
    for category, keywords in mapping.items():
        if any(keyword in normalized for keyword in keywords):
            return category
    return default


def _match_stage(normalized: str) -> Optional[str]:
    for stage, keywords in STAGE_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            return stage
    return None


def _trim_sentence(value: str, max_len: int) -> str:
    cleaned = " ".join(value.split())
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 1].rstrip() + "…"


def _smart_title(value: str) -> str:
    words = [word for word in re.split(r"\s+", value.strip()) if word]
    return " ".join(word.capitalize() if word.isalpha() else word for word in words)


def _normalize(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())
