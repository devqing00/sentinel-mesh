import asyncio
import os
import random
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def populate_audit_logs():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
    db = client.sentinel_mesh
    
    # Check if already populated
    if await db.audit_log.count_documents({}) > 0:
        print("Audit logs already populated")
        return
        
    print("Populating audit logs...")
    
    # Get some anomalous vitals
    cursor = db.vitals.find({"temp_status": "high"}).limit(10)
    anomalous = []
    async for doc in cursor:
        anomalous.append(doc)
        
    now = datetime.utcnow()
    logs = []
    
    # Create system alerts
    logs.append({
        "cluster_id": "SYSTEM",
        "title": "System Sync Completed",
        "message": "Data fully synchronized with central epidemiological database. All nodes active.",
        "type": "system",
        "timestamp": now - timedelta(hours=1),
        "status": "success",
        "read": False
    })
    
    logs.append({
        "cluster_id": "SYSTEM",
        "title": "New Node Registered",
        "message": "Node U-099 successfully onboarded to the Mesh.",
        "type": "hardware",
        "timestamp": now - timedelta(hours=3),
        "status": "success",
        "read": False
    })
    
    # Create anomaly alerts based on real data
    for i, v in enumerate(anomalous):
        logs.append({
            "cluster_id": v.get("geohash", "UNKNOWN")[:5],
            "title": "Elevated Temperature Warning" if v.get("temp_status") == "high" else "Proximity Breach Detected",
            "message": f"Device {v.get('device_id')} exhibiting thermal readings above baseline ({v.get('temperature')}°C).",
            "type": "anomaly",
            "timestamp": now - timedelta(minutes=random.randint(5, 120)),
            "status": "warning",
            "read": False,
            "metadata": {
                "device_id": v.get("device_id"),
                "temperature": v.get("temperature"),
                "geohash": v.get("geohash")
            }
        })
        
    if logs:
        await db.audit_log.insert_many(logs)
        print(f"Inserted {len(logs)} audit logs.")
        
if __name__ == "__main__":
    asyncio.run(populate_audit_logs())
