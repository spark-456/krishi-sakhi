from datetime import datetime


DEMO_BLOG_POSTS = [
    {
        "title": "Pre-Monsoon Field Preparation Checklist for Small Farms",
        "summary": "A short checklist for cleaning bunds, checking drainage, and preparing seed and fertilizer plans before the first major rains.",
        "content": (
            "Before the monsoon begins, farmers should inspect field bunds, clear water channels, and repair weak entry points where runoff can breach the plot.\n\n"
            "Seed lots should be checked for viability, fertilizer should be stored above ground level, and irrigation lines should be repaired before the rains make field movement difficult.\n\n"
            "If a farmer is planning to sow during the first effective rainfall, land preparation, input booking, and labour coordination should be completed early so the sowing window is not missed."
        ),
        "category": "best_practice",
        "tags": ["monsoon", "field_preparation", "smallholder"],
        "target_district": None,
        "target_state": "Telangana",
        "cover_image_url": None,
    },
    {
        "title": "Weather Advisory: Delay Spraying When Rain Is Likely Within 24 Hours",
        "summary": "Spraying just before rainfall increases wastage and weakens pest control. Review the forecast before applying pesticides or foliar nutrients.",
        "content": (
            "When moderate or heavy rainfall is expected within the next 24 hours, pesticide and foliar nutrient sprays should generally be delayed.\n\n"
            "Rain can wash off active ingredients before they settle on the crop canopy, increasing both cost and ineffective application.\n\n"
            "Farmers should use early-morning or late-evening windows with lower wind and confirm field access conditions before spraying."
        ),
        "category": "weather_advisory",
        "tags": ["spraying", "rainfall", "weather"],
        "target_district": None,
        "target_state": "Telangana",
        "cover_image_url": None,
    },
    {
        "title": "Market Update: Why Harvest Timing Matters More Than a Single-Day Price Spike",
        "summary": "Farmers often react to one high mandi price, but transport cost, moisture level, and nearby arrival volume matter just as much.",
        "content": (
            "A temporary mandi spike does not always translate into better net income if transport, commission, and moisture deductions are high.\n\n"
            "Farmers should compare the likely sale price with handling costs and check whether local arrivals are increasing, because that can soften rates quickly.\n\n"
            "Basic post-harvest planning, especially drying and sorting, often improves realized value more than rushing to sell on a single high-price day."
        ),
        "category": "market_update",
        "tags": ["mandi", "pricing", "post_harvest"],
        "target_district": None,
        "target_state": "Telangana",
        "cover_image_url": None,
    },
    {
        "title": "Pest Alert: Scout Cotton Fields Early for Leaf Damage and Sucking Pests",
        "summary": "Early scouting helps detect stress before visible spread becomes severe. Monitor the underside of leaves and border rows first.",
        "content": (
            "Cotton fields should be monitored regularly for leaf curling, yellowing, and sucking-pest pressure, especially during warm and humid phases.\n\n"
            "Border rows and shaded sections often show symptoms earlier, so those spots should be checked first during routine field walks.\n\n"
            "Farmers should avoid blanket spraying without field confirmation and instead record observations, affected patches, and weather conditions before treatment."
        ),
        "category": "pest_alert",
        "tags": ["cotton", "scouting", "pest_alert"],
        "target_district": None,
        "target_state": "Telangana",
        "cover_image_url": None,
    },
    {
        "title": "Government Scheme Reminder: Keep Land and Bank Records Ready Before Application Windows Open",
        "summary": "Many farmers miss scheme deadlines because key records are incomplete. Preparing documents early reduces last-minute rejection risk.",
        "content": (
            "Applications for subsidy, insurance, and support schemes often fail because of missing land records, bank linkage issues, or incomplete identity details.\n\n"
            "Farmers should keep digital and printed copies of their land passbook, Aadhaar, bank details, and mobile number alignment ready before the notification window opens.\n\n"
            "Village-level coordination with local extension staff becomes much smoother when the paperwork is prepared in advance."
        ),
        "category": "government_scheme",
        "tags": ["scheme", "documents", "subsidy"],
        "target_district": None,
        "target_state": "Telangana",
        "cover_image_url": None,
    },
    {
        "title": "Training Announcement: Water-Efficient Irrigation Practices for Borewell-Dependent Farms",
        "summary": "A representative extension update encouraging farmers to reduce unnecessary irrigation cycles and improve watering discipline.",
        "content": (
            "Borewell-dependent farms benefit from disciplined irrigation intervals, moisture observation, and field-specific planning instead of fixed daily watering.\n\n"
            "Farmers are encouraged to compare crop stage, weather conditions, and soil moisture retention before scheduling the next irrigation cycle.\n\n"
            "Demonstration sessions can cover furrow management, drip-line maintenance, and simple field indicators that help reduce water waste."
        ),
        "category": "training",
        "tags": ["irrigation", "training", "water_use"],
        "target_district": None,
        "target_state": "Telangana",
        "cover_image_url": None,
    },
]


def build_demo_blog_payloads(author_id: str) -> list[dict]:
    published_at = datetime.utcnow().isoformat()
    payloads = []
    for post in DEMO_BLOG_POSTS:
        payloads.append({
            **post,
            "author_id": author_id,
            "is_published": True,
            "published_at": published_at,
        })
    return payloads
