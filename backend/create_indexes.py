import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")

async def run():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client.get_database("sentinelmesh")
    
    print("Creating indexes on vitals...")
    await db.vitals.create_index([("device_id", 1), ("timestamp", -1)])
    await db.vitals.create_index([("timestamp", -1)])
    print("Indexes created.")
    
if __name__ == "__main__":
    asyncio.run(run())
