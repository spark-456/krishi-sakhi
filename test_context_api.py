import json
import asyncio
from uuid import UUID
from supabase import create_client
import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from config import settings
from services.context_assembler import assemble_context

async def test_diagnostic():
    print("--- START DIAGNOSTIC ---")
    try:
        db = create_client(settings.supabase_url, settings.supabase_anon_key)
        
        # 1. Check if we can find ANY farmer
        res = db.table('farmers').select('*').limit(1).execute()
        if not res.data:
            print("❌ ERROR: No farmers found in 'farmers' table. Context will always be empty.")
            return

        farmer = res.data[0]
        farmer_id = farmer['id']
        print(f"✅ Found Farmer: {farmer.get('full_name')} (ID: {farmer_id})")

        # 2. Run assemble_context
        print(f"Running assemble_context for {farmer_id}...")
        context = await assemble_context(farmer_id, None, None, db, query="Tell me about myself")
        
        # 3. Verify results
        f_data = context.get('farmer', {})
        if f_data.get('full_name'):
            print(f"✅ Context Assembler SUCCESS: Found name '{f_data.get('full_name')}'")
        else:
            print("❌ Context Assembler FAILURE: Farmer data is empty in context.")

        print("\nSummary of gathered context:")
        print(f"- District: {f_data.get('district')}")
        print(f"- Farms: {len(context.get('farms', []))}")
        print(f"- Crops: {len(context.get('crops', []))}")
        
    except Exception as e:
        print(f"❌ CRITICAL ERROR during test: {str(e)}")
    print("--- END DIAGNOSTIC ---")

if __name__ == "__main__":
    asyncio.run(test_diagnostic())
