import os
import sys

from dotenv import load_dotenv
from supabase import create_client

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT, ".env"))
sys.path.append(os.path.join(ROOT, "backend"))

from services.demo_blog_posts import build_demo_blog_payloads  # noqa: E402


def main():
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
    if not supabase_url or not service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.")

    db = create_client(supabase_url, service_role_key)
    admin = db.table("farmers").select("id").eq("role", "admin").limit(1).execute()
    if not admin.data:
        raise RuntimeError("No admin user found in farmers table.")

    created = 0
    skipped = 0
    for payload in build_demo_blog_payloads(admin.data[0]["id"]):
        existing = db.table("blog_posts").select("id").eq("title", payload["title"]).limit(1).execute()
        if existing.data:
            skipped += 1
            continue
        res = db.table("blog_posts").insert(payload).execute()
        if res.data:
            created += 1

    print({"created": created, "skipped": skipped})


if __name__ == "__main__":
    main()
