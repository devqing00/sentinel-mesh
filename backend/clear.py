import asyncio
import httpx
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def reset_db():
    db = AsyncIOMotorClient(os.getenv("MONGO_URI")).sentinelmesh
    print("Clearing anomalies and audit logs...")
    await db.anomalies.delete_many({})
    await db.audit_log.delete_many({})
    print("Triggering ingest/all endpoint to reset data...")
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post("http://localhost:8000/api/ingest/all")
        print(r.json())

if __name__ == "__main__":
    asyncio.run(reset_db())
