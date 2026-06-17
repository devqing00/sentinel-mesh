import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone, timedelta

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/sentinelmesh")

async def run():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client.get_database()
    
    # Create indexes to ensure fast queries
    print("Creating indexes...")
    await db.vitals.create_index([("device_id", 1), ("timestamp", -1)])
    await db.vitals.create_index([("timestamp", -1)])
    print("Indexes created.")
    
    # Test new logic
    one_day_ago = datetime.now(timezone.utc) - timedelta(days=1)
    
    print("Fetching distinct devices...")
    # Just get devices from live_simulation or distinct
    device_ids = await db.vitals.distinct("device_id", {"timestamp": {"$gte": one_day_ago}})
    print(f"Found {len(device_ids)} devices.")
    
    if not device_ids:
        # fallback to all distinct if none in last 24h
        device_ids = await db.vitals.distinct("device_id")
    
    results = []
    
    for did in device_ids:
        # Get latest 20 readings
        cursor = db.vitals.find({"device_id": did}).sort("timestamp", -1).limit(20)
        latest_docs = await cursor.to_list(length=20)
        
        if not latest_docs:
            continue
            
        latest_doc = latest_docs[0]
        
        # Get the oldest reading in the 24h window to calculate decline
        oldest_cursor = db.vitals.find({
            "device_id": did,
            "timestamp": {"$gte": one_day_ago}
        }).sort("timestamp", 1).limit(1)
        
        oldest_docs = await oldest_cursor.to_list(length=1)
        oldest_doc = oldest_docs[0] if oldest_docs else latest_docs[-1]
        
        # Total reading count for this device in 24h
        reading_count = await db.vitals.count_documents({
            "device_id": did,
            "timestamp": {"$gte": one_day_ago}
        })
        
        # Build history array (chronological order)
        history = []
        for doc in reversed(latest_docs):
            history.append({
                "battery": doc.get("battery"),
                "timestamp": doc.get("timestamp"),
                "movement": doc.get("movement"),
                "temperature": doc.get("temperature"),
                "heartbeat": doc.get("heartbeat")
            })
            
        latest_battery = latest_doc.get("battery", 0)
        first_battery = oldest_doc.get("battery", 0)
        
        # Calculate decline rate
        decline_rate = 0
        projected_hours = 999
        first_seen = oldest_doc.get("timestamp")
        last_seen = latest_doc.get("timestamp")
        
        if reading_count >= 2 and first_seen and last_seen:
            # Ensure timezone awareness
            if getattr(first_seen, 'tzinfo', None) is None:
                first_seen = first_seen.replace(tzinfo=timezone.utc)
            if getattr(last_seen, 'tzinfo', None) is None:
                last_seen = last_seen.replace(tzinfo=timezone.utc)
                
            time_span = last_seen - first_seen
            hours_span = max(time_span.total_seconds() / 3600, 0.1)
            battery_drop = first_battery - latest_battery
            
            if battery_drop > 0:
                decline_rate = battery_drop / hours_span
                projected_hours = latest_battery / decline_rate if decline_rate > 0 else 999
                
        if latest_battery <= 0:
            status = "dead"
        elif latest_battery < 10:
            status = "critical"
        elif latest_battery < 20 or projected_hours < 24:
            status = "needs_visit"
        else:
            status = "ok"
            
        near_charging = latest_doc.get("movement") == 0 and latest_battery > first_battery
        
        results.append({
            "device_id": did,
            "battery_percent": latest_battery,
            "projected_hours_remaining": round(min(projected_hours, 999), 1),
            "decline_rate_per_hour": round(decline_rate, 2),
            "status": status,
            "last_seen": last_seen,
            "reading_count": reading_count,
            "near_charging": near_charging,
            "latest_temp": latest_doc.get("temperature"),
            "latest_hr": latest_doc.get("heartbeat"),
            "temp_status": latest_doc.get("temp_status"),
            "hr_status": latest_doc.get("hr_status"),
            "geohash": latest_doc.get("geohash"),
            "lat": latest_doc.get("latitude") or latest_doc.get("lat"),
            "lon": latest_doc.get("longitude") or latest_doc.get("lon"),
            "vitals_history": history
        })
        
    print(f"Processed {len(results)} results successfully.")
    
if __name__ == "__main__":
    asyncio.run(run())
