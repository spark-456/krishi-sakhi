import httpx
import asyncio

async def test_apis():
    print("Testing Backend Health...")
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get("http://localhost:8000/health")
            print(f"Backend Health: {res.status_code} - {res.text}")
        except Exception as e:
            print(f"Backend Health Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_apis())
