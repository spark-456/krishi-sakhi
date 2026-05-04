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
    {
        "title": "Best Practice: Separate Input Planning for Main Crop and Border Crop",
        "summary": "Mixed and border planting can improve resilience, but only if farmers track input use separately and avoid blanket application.",
        "content": (
            "When a farm uses a main crop with a border crop or intercrop, inputs should be planned according to crop need rather than applied uniformly across the full field.\n\n"
            "Separate records for seed, fertilizer, labour, and irrigation help farmers understand which part of the field is driving cost and where returns are strongest.\n\n"
            "Even a simple handwritten or digital split by plot section improves decision quality during the next season."
        ),
        "category": "best_practice",
        "tags": ["intercropping", "planning", "input_management"],
        "target_district": None,
        "target_state": "Telangana",
        "cover_image_url": None,
    },
    {
        "title": "Weather Advisory: Strong Winds Can Reduce Spray Efficiency Even Without Rain",
        "summary": "Spray decisions should consider wind speed as well as rainfall. Drift losses can be significant on exposed plots.",
        "content": (
            "Farmers often check only for rain before spraying, but strong winds can reduce application quality and increase chemical drift to non-target areas.\n\n"
            "When wind conditions are unstable, early-morning or calmer evening windows are usually safer for field operations than midday application.\n\n"
            "Recording weather conditions alongside the spray event improves future field planning and cost control."
        ),
        "category": "weather_advisory",
        "tags": ["wind", "spraying", "field_operations"],
        "target_district": None,
        "target_state": "Telangana",
        "cover_image_url": None,
    },
    {
        "title": "Market Update: Track Transport and Labour Costs Alongside Sale Price",
        "summary": "A higher selling rate is not always the better decision if loading, transport, and handling costs have risen sharply.",
        "content": (
            "Farmers comparing selling options should look beyond the mandi rate and account for loading, unloading, transport, packaging, and labour costs.\n\n"
            "A nearby buyer offering a slightly lower price may still yield a better net result if handling losses and travel expenses are lower.\n\n"
            "Farm-level cost tracking helps make this comparison practical instead of relying on price alone."
        ),
        "category": "market_update",
        "tags": ["selling", "transport", "net_returns"],
        "target_district": None,
        "target_state": "Telangana",
        "cover_image_url": None,
    },
    {
        "title": "Pest Alert: Moisture Stress and Pest Pressure Often Appear Together",
        "summary": "Fields under uneven irrigation or prolonged dryness should be watched closely because stressed plants are more vulnerable to attack.",
        "content": (
            "Crops under moisture stress often show weaker recovery and may become more vulnerable to pest pressure during hot intervals.\n\n"
            "Farmers should check patchy areas, field edges, and recently stressed sections first when scouting for pest damage.\n\n"
            "Irrigation records, rainfall conditions, and scouting notes together provide better decision support than visual symptoms alone."
        ),
        "category": "pest_alert",
        "tags": ["moisture_stress", "scouting", "crop_health"],
        "target_district": None,
        "target_state": "Telangana",
        "cover_image_url": None,
    },
    {
        "title": "Government Update: Verify Bank Linkage Before Subsidy or Insurance Submission",
        "summary": "Application rejection often happens because the bank account, identity details, and mobile number are not aligned.",
        "content": (
            "Before applying for subsidy or insurance support, farmers should verify that their bank linkage, identity details, and registered mobile number are consistent across records.\n\n"
            "Corrections made after the submission window opens often create delays that are difficult to resolve locally.\n\n"
            "A short pre-check at the village or mandal level can prevent avoidable application failure."
        ),
        "category": "government_scheme",
        "tags": ["bank_linkage", "insurance", "application_readiness"],
        "target_district": None,
        "target_state": "Telangana",
        "cover_image_url": None,
    },
    {
        "title": "Announcement: Use AskSakhi Activity and Expense Logs to Build a Season Record",
        "summary": "Consistent logging improves visibility into farm decisions and makes advisory suggestions more context-aware over time.",
        "content": (
            "Farmers are encouraged to log major activities, expenses, and crop-stage changes in the app throughout the season instead of only at harvest time.\n\n"
            "A complete season record helps identify high-cost windows, repeated field issues, and the timing of key operations.\n\n"
            "It also improves the quality of AskSakhi recommendations because the advisory layer can work from actual farm history."
        ),
        "category": "announcement",
        "tags": ["asksakhi", "recordkeeping", "digital_advisory"],
        "target_district": None,
        "target_state": "Telangana",
        "cover_image_url": None,
    },
    {
        "title": "Training Note: Review Input Stocks Before the Peak Sowing Window",
        "summary": "Seed, fertilizer, and protective-input shortages during the sowing period force rushed purchases and weaker decisions.",
        "content": (
            "Before the peak sowing period begins, farmers should review available seed, nutrient, and protective-input stocks and estimate shortfalls early.\n\n"
            "Late purchase during high-demand weeks often increases cost and reduces choice in product quality or source.\n\n"
            "Basic pre-sowing budgeting also helps align labour and transport planning with actual field needs."
        ),
        "category": "training",
        "tags": ["sowing", "inventory", "input_planning"],
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
