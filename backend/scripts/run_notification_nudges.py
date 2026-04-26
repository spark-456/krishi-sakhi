import asyncio
import os
import sys
from datetime import date

from dotenv import load_dotenv
from supabase import create_client

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT, ".env"))

sys.path.append(os.path.join(ROOT, "backend"))

from services.notifications import generate_daily_nudges  # noqa: E402


async def main():
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
    if not supabase_url or not service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.")

    db = create_client(supabase_url, service_role_key)
    summary = await generate_daily_nudges(db, run_date=date.today())
    print(summary)


if __name__ == "__main__":
    asyncio.run(main())
