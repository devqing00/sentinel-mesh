import asyncio
import random
import uuid
from datetime import datetime, timedelta
import os
from motor.motor_asyncio import AsyncIOMotorClient

# Setup DB connection
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/sentinelmesh")

COMMUNITIES = [
    {"name": "Cluster A", "lat": 6.5244, "lon": 3.3792}, # Lagos approx
    {"name": "Cluster B", "lat": 6.5300, "lon": 3.3850},
    {"name": "Cluster C", "lat": 6.5100, "lon": 3.3600},
]

async def generate_data():
    client = AsyncIOMotorClient(MONGO_URI)
    db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0]
    if not db_name or db_name == "localhost:27017":
        db_name = "sentinelmesh"
    db = client[db_name]

    print("Clearing existing data...")
    await db.contacts.delete_many({})
    await db.vitals.delete_many({})

    # Generate 235 devices
    devices = [f"dev_{i:03d}_{uuid.uuid4().hex[:6]}" for i in range(235)]
    
    # Assign anomalies to 5 devices in Cluster A
    anomalous_devices = devices[:5]

    # Generate records
    base_time = datetime.utcnow() - timedelta(days=2)
    
    contacts_batch = []
    vitals_batch = []
    
    print("Generating records...")
    for i, device in enumerate(devices):
        # Assign to a community
        community = COMMUNITIES[0] if device in anomalous_devices else random.choice(COMMUNITIES)
        
        battery = random.uniform(80.0, 100.0)
        
        for step in range(50): # 50 timesteps per device
            current_time = base_time + timedelta(hours=step)
            
            # small random walk
            lat = community["lat"] + random.uniform(-0.005, 0.005)
            lon = community["lon"] + random.uniform(-0.005, 0.005)
            
            # contacts
            contact_device_id = random.choice(devices) if random.random() < 0.2 else None
            
            contacts_batch.append({
                "device_id": device,
                "timestamp": current_time,
                "latitude": lat,
                "longitude": lon,
                "geohash": f"{lat:.3f},{lon:.3f}", # simple mock geohash
                "contact_device_id": contact_device_id,
                "rssi": random.uniform(-90, -40) if contact_device_id else None
            })
            
            # vitals (~1% of records)
            if random.random() < 0.01 or (device in anomalous_devices and random.random() < 0.1):
                temp = random.uniform(36.0, 37.5)
                hr = random.randint(60, 90)
                
                if device in anomalous_devices:
                    temp = random.uniform(38.1, 40.0)
                    hr = random.randint(101, 130)
                
                # Battery drops
                battery -= random.uniform(0.5, 2.0)
                if battery < 0:
                    battery = 100.0 # random recharge
                
                vitals_batch.append({
                    "device_id": device,
                    "timestamp": current_time,
                    "body_temperature_c": temp,
                    "heart_rate_bpm": hr,
                    "movement_status": random.choice([0, 1]),
                    "battery_percent": max(0.0, battery)
                })

    print(f"Inserting {len(contacts_batch)} contacts...")
    if contacts_batch:
        await db.contacts.insert_many(contacts_batch)
        
    print(f"Inserting {len(vitals_batch)} vitals...")
    if vitals_batch:
        await db.vitals.insert_many(vitals_batch)

    client.close()
    print("Mock data generation complete!")

if __name__ == "__main__":
    asyncio.run(generate_data())
