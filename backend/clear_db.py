import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def clear_mongo():
    load_dotenv()
    uri = os.getenv('MONGODB_URI')
    if not uri:
        print("MONGODB_URI not found.")
        return
        
    print(f"Connecting to MongoDB: {uri.split('@')[-1]}")
    client = AsyncIOMotorClient(uri)
    db_name = "sentinelmesh"
    if "/" in uri.split("mongodb.net")[-1]:
        db_name = uri.split("/")[-1].split("?")[0]
        if not db_name:
            db_name = "sentinelmesh"
            
    db = client[db_name]
    
    print("Dropping heavy collections to free up the 512MB quota...")
    try:
        await db.vitals.drop()
        print("Dropped 'vitals'")
        await db.contacts.drop()
        print("Dropped 'contacts'")
        await db.mobility.drop()
        print("Dropped 'mobility'")
        print("Successfully cleared the database!")
    except Exception as e:
        print(f"Error dropping collections: {e}")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(clear_mongo())
