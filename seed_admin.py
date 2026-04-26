import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_KEY in backend/.env")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def seed_admin():
    print("--- Krishi Sakhi Admin Seeding ---")
    phone = input("Enter the phone number of the farmer to make admin (e.g., +919876543210): ").strip()
    
    if not phone:
        print("Phone number cannot be empty.")
        return

    # Check if farmer exists
    res = supabase.table("farmers").select("id, full_name, role").eq("phone_number", phone).execute()
    
    if not res.data:
        print(f"Error: No farmer found with phone number {phone}.")
        print("Please register via the app first.")
        return
        
    farmer = res.data[0]
    
    if farmer.get("role") == "admin":
        print(f"Farmer '{farmer.get('full_name')}' is already an admin.")
        return
        
    # Update role
    update_res = supabase.table("farmers").update({"role": "admin"}).eq("id", farmer["id"]).execute()
    
    if update_res.data:
        print(f"Success! '{farmer.get('full_name')}' has been granted admin privileges.")
    else:
        print("Failed to update role.")

if __name__ == "__main__":
    seed_admin()
