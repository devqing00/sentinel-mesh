import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/sentinelmesh")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    db_instance.client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0]
    if not db_name or db_name == "localhost:27017":
        db_name = "sentinelmesh"
    db_instance.db = db_instance.client[db_name]
    print(f"Connected to MongoDB: {db_name}")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        print("Closed MongoDB connection")

def get_database():
    return db_instance.db
