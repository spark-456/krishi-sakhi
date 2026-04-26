import os
import random
import uuid
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env")
    exit(1)

# Initialize Supabase client with Service Role Key to bypass RLS and create users
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==========================================
# REALISTIC DATA POOLS (Telangana Context)
# ==========================================

SURNAMES = [
    "Reddy", "Goud", "Rao", "Dasari", "Konda", "Yadav", "Bandi", "Chiluka", 
    "Golla", "Kummari", "Madiga", "Mudiraj", "Pinninti", "Boya", "Jadhav"
]

MALE_NAMES = [
    "Venkatesh", "Ramakrishna", "Srinivas", "Ramesh", "Mahesh", 
    "Narsimha", "Rajesh", "Yadagiri", "Mallesh", "Anjaneyulu", "Krishna", "Prasad"
]

FEMALE_NAMES = [
    "Lakshmi", "Kavitha", "Sujatha", "Swapna", "Anitha", 
    "Bhavani", "Saritha", "Padma", "Radha", "Swaroopa"
]

# Telangana Districts and their Mandals
DISTRICT_DATA = {
    "Siddipet": ["Gajwel", "Dubbak", "Husnabad", "Cherial", "Toguta"],
    "Warangal": ["Narsampet", "Wardhannapet", "Parvathagiri", "Rayaparthy"],
    "Nalgonda": ["Miryalaguda", "Nakrekal", "Suryapet", "Munugode"],
    "Karimnagar": ["Huzurabad", "Choppadandi", "Manakondur", "Jammikunta"],
    "Khammam": ["Madhira", "Sathupalli", "Wyra", "Kusumanchi"],
    "Mahabubnagar": ["Jadcherla", "Devarkadra", "Narayanpet", "Makthal"]
}

SOIL_TYPES = ["red", "black", "clay", "loam", "sandy"]
IRRIGATION_TYPES = ["borewell", "canal", "rainfed", "drip"]

# Zaid/Summer crops appropriate for April 2026
ACTIVE_CROPS = [
    {"name": "Paddy (Summer)", "season": "zaid", "days_to_mature": 120, "stages": ["vegetative", "flowering"]},
    {"name": "Maize", "season": "zaid", "days_to_mature": 100, "stages": ["vegetative", "flowering"]},
    {"name": "Groundnut", "season": "zaid", "days_to_mature": 110, "stages": ["flowering"]},
    {"name": "Mango", "season": "zaid", "days_to_mature": 150, "stages": ["flowering"]},
    {"name": "Chilli", "season": "rabi", "days_to_mature": 150, "stages": ["post_harvest"]}
]

COOP_GROUP_NAMES = [
    "Gajwel Organic Farmers Co-op",
    "Warangal Cotton Growers Assoc.",
    "Nalgonda Paddy Union",
    "Karimnagar Seed Network",
    "Mahabubnagar Drip Irrigation Group",
    "Siddipet Women Farmers Collective"
]

HELP_REQUEST_TEMPLATES = [
    ("Need tractor for {task}", "equipment_needed", "urgent"),
    ("Looking to rent a rotavator for {acreage} acres", "equipment_needed", "normal"),
    ("Anyone has spare {crop} seeds?", "seeds_needed", "urgent"),
    ("Need labor for {crop} harvesting next week", "labour_needed", "normal"),
    ("My borewell pump failed, need a mechanic contact", "advice_needed", "urgent"),
    ("Looking for transport to local mandi for 20 quintals", "transport_share", "normal")
]

RESOURCE_TEMPLATES = [
    ("5HP Submersible Pump", "equipment", "Rs 150/day"),
    ("Mahindra Tractor", "equipment", "Rs 800/hour with driver"),
    ("Empty Godown space (500 sqft)", "storage", "Rs 2000/month"),
    ("Battery Sprayer", "equipment", "Free for group members"),
    ("Excess {crop} seeds from last season", "seeds", "Exchange only")
]

def generate_phone(index):
    # Random 10 digit number starting with 95
    import random
    return f"+9195{random.randint(10000000, 99999999)}"

def random_date(start_days_ago, end_days_ago):
    delta = timedelta(days=random.randint(end_days_ago, start_days_ago))
    return (datetime.now() - delta).date().isoformat()

def clear_existing_demo_users():
    print("Clearing existing demo users...")
    # Clean up emails ending with @ks.com or phones
    try:
        users = supabase.auth.admin.list_users()
        for u in users:
            if u.email and u.email.endswith("@ks.com"):
                supabase.auth.admin.delete_user(u.id)
            elif u.phone and u.phone.startswith("+91900000"):
                supabase.auth.admin.delete_user(u.id)
            elif u.phone in ["+919999999999", "+918888888888"]:
                supabase.auth.admin.delete_user(u.id)
    except Exception as e:
        print(f"Warning during cleanup: {e}")

def create_user(phone, name, role, district, block):
    uid = None
    try:
        # Create auth user
        user_data = supabase.auth.admin.create_user({
            "email": f"{phone}@ks.com",
            "password": "password123456",
            "email_confirm": True,
            "user_metadata": {"full_name": name, "phone": phone}
        })
        uid = user_data.user.id
    except Exception as e:
        if "already registered" in str(e).lower() or "422" in str(e):
            # Try to find the user in the farmers table to get their ID
            res = supabase.table("farmers").select("id").eq("full_name", name).execute()
            if res.data:
                uid = res.data[0]['id']
            else:
                # If not found, we can't easily get the auth ID by phone via API, so we skip or print
                print(f"Skipping {phone} - already registered but not in farmers table.")
                return None
        else:
            raise e
            
    if not uid:
        return None
        
    # Upsert into farmers table
    supabase.table("farmers").upsert({
        "id": uid,
        "full_name": name,
        "preferred_language": random.choice(["telugu", "telugu", "english"]), # High bias for Telugu
        "state": "Telangana",
        "district": district,
        "block": block,
        "village": f"{block} Village",
        "onboarding_complete": True,
        "role": role
    }).execute()
    
    return uid

def generate_farms_and_crops(uid):
    num_farms = random.choices([1, 2, 3], weights=[0.6, 0.3, 0.1])[0]
    farms = []
    
    for i in range(num_farms):
        area = round(random.uniform(1.0, 8.0), 2)
        soil = random.choice(SOIL_TYPES)
        irrigation = random.choice(IRRIGATION_TYPES)
        
        farm_res = supabase.table("farms").insert({
            "farmer_id": uid,
            "farm_name": f"Plot {i+1} ({area} acres)",
            "area_acres": area,
            "soil_type": soil,
            "irrigation_type": [irrigation],
            "latitude": round(17.3850 + random.uniform(-1.0, 1.0), 4),
            "longitude": round(78.4867 + random.uniform(-1.0, 1.0), 4)
        }).execute()
        
        farm_id = farm_res.data[0]['id']
        farms.append(farm_id)
        
        # Add active crop
        crop = random.choice(ACTIVE_CROPS)
        sowing_date = random_date(100, 30) # Sown 30 to 100 days ago
        
        supabase.table("crop_records").insert({
            "farm_id": farm_id,
            "farmer_id": uid,
            "crop_name": crop["name"],
            "season": crop["season"],
            "sowing_date": sowing_date,
            "growth_stage": random.choice(crop["stages"]),
            "status": "active"
        }).execute()
        
        # 50% chance to have a historical crop
        if random.random() > 0.5:
            hist_sowing = random_date(300, 200)
            hist_harvest = random_date(180, 120)
            supabase.table("crop_records").insert({
                "farm_id": farm_id,
                "farmer_id": uid,
                "crop_name": "Cotton" if crop["name"] != "Cotton" else "Paddy",
                "season": "kharif",
                "sowing_date": hist_sowing,
                "actual_harvest_date": hist_harvest,
                "growth_stage": "post_harvest",
                "status": "harvested"
            }).execute()

def populate():
    print("--- Krishi Sakhi Data Population Script ---")
    clear_existing_demo_users()
    
    # 1. Create specific Demo Accounts
    print("Creating Demo Accounts...")
    demo_farmer_id = create_user("+919999999999", "Demo Farmer (Raju)", "farmer", "Siddipet", "Gajwel")
    demo_admin_id = create_user("+918888888888", "Demo Admin (KVK)", "admin", "Hyderabad", "Central")
    
    generate_farms_and_crops(demo_farmer_id)
    
    # 2. Fetch existing farmers to use for cooperative generation
    print("Fetching existing farmers...")
    all_farmers_res = supabase.table("farmers").select("id").execute()
    all_uids = [f['id'] for f in all_farmers_res.data]
    
    if not all_uids:
        print("No farmers found. Make sure to run the farmer generation first.")
        return

    # 3. Create Cooperative Groups
    print("Generating SakhiNet Community Data...")
    group_ids = []
    for g_name in COOP_GROUP_NAMES:
        district = random.choice(list(DISTRICT_DATA.keys()))
        owner_id = random.choice(all_uids)
        
        res = supabase.table("cooperative_groups").insert({
            "name": g_name,
            "description": f"Local cooperative for farmers in {district}. Supporting each other through shared resources and knowledge.",
            "district": district,
            "state": "Telangana",
            "created_by": owner_id
        }).execute()
        g_id = res.data[0]['id']
        group_ids.append(g_id)
        
        # Add owner membership
        supabase.table("cooperative_memberships").insert({
            "group_id": g_id,
            "farmer_id": owner_id,
            "role": "admin"
        }).execute()

    # 4. Add Memberships to Groups
    for uid in all_uids:
        if random.random() > 0.4: # 60% of farmers join a group
            g_id = random.choice(group_ids)
            try:
                supabase.table("cooperative_memberships").insert({
                    "group_id": g_id,
                    "farmer_id": uid,
                    "role": "member"
                }).execute()
            except:
                pass # ignore duplicates

    # 5. Generate Help Requests & Resources
    for g_id in group_ids:
        # Get members of this group
        m_res = supabase.table("cooperative_memberships").select("farmer_id").eq("group_id", g_id).execute()
        members = [m['farmer_id'] for m in m_res.data]
        
        if not members: continue
        
        # 3-5 Help Requests per group
        for _ in range(random.randint(3, 5)):
            requester = random.choice(members)
            template = random.choice(HELP_REQUEST_TEMPLATES)
            
            task = random.choice(["plowing", "leveling", "sowing"])
            acreage = random.choice([2, 5, 1.5])
            crop = random.choice(["Paddy", "Maize", "Cotton"])
            
            title = template[0].format(task=task, acreage=acreage, crop=crop)
            
            supabase.table("help_requests").insert({
                "group_id": g_id,
                "farmer_id": requester,
                "title": title,
                "category": template[1],
                "urgency": template[2],
                "description": "Looking for immediate assistance. Willing to pay standard daily rates.",
                "status": "open",
                "expires_at": (datetime.now() + timedelta(days=7)).isoformat()
            }).execute()

        # 2-4 Shared Resources per group
        for _ in range(random.randint(2, 4)):
            provider = random.choice(members)
            template = random.choice(RESOURCE_TEMPLATES)
            crop = random.choice(["Paddy", "Maize", "Cotton"])
            
            title = template[0].format(crop=crop)
            
            supabase.table("shared_resources").insert({
                "group_id": g_id,
                "farmer_id": provider,
                "title": title,
                "resource_type": template[1],
                "cost_per_use": template[2],
                "description": "Contact me through the group if you need this.",
                "availability_status": "available"
            }).execute()
            
    print("=================================================")
    print("✅ Demo Data Population Complete!")
    print("=================================================")
    print("Demo Admin:  +918888888888 (OTP: 123456) - Verify in Supabase Auth settings")
    print("Demo Farmer: +919999999999 (OTP: 123456)")

if __name__ == "__main__":
    populate()
