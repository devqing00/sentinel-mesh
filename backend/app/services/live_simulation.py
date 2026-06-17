import asyncio
import random
import uuid
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/sentinelmesh")

# Pre-generate some known devices
DEVICES = [f"live_{i:03d}_{uuid.uuid4().hex[:6]}" for i in range(100)]
ANOMALOUS_DEVICES = DEVICES[:5] # 5% consistently anomalous

async def live_simulation_loop():
    """Background task that pumps live IoT data into MongoDB."""
    
    # Set up client just for the background worker
    client = AsyncIOMotorClient(MONGO_URI)
    db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0]
    if not db_name or db_name == "localhost:27017":
        db_name = "sentinelmesh"
    db = client[db_name]

    print("[Live Simulation] Started. Pumping data to MongoDB every 5 seconds...")

    # Center around Nigeria dataset approx (lat 7.84, lon 9.77)
    base_lat = 7.84
    base_lon = 9.77

    while True:
        try:
            contacts_batch = []
            vitals_batch = []
            mobility_batch = []
            now = datetime.utcnow() # inherently 2026

            # Pick a subset of 20 active devices this second
            active_devices = random.sample(DEVICES, 20)

            for device in active_devices:
                lat = base_lat + random.uniform(-0.02, 0.02)
                lon = base_lon + random.uniform(-0.02, 0.02)
                gh = f"{lat:.3f},{lon:.3f}"

                contact_device = random.choice(DEVICES) if random.random() < 0.3 else None

                date_str = now.strftime("%Y-%m-%d")
                time_str = now.strftime("%H:%M:%S")

                # 1. Contact Tracing (user_id, date, time, latitude, longitude, geohash, mac, rssi, proximity)
                contacts_batch.append({
                    "user_id": device.replace("live_", "user_"),
                    "date": date_str,
                    "time": time_str,
                    "latitude": lat,
                    "longitude": lon,
                    "geohash": gh,
                    "mac": contact_device if contact_device else "00:00:00:00:00:00",
                    "rssi": random.uniform(-90, -40) if contact_device else None,
                    "proximity": "close" if contact_device else "none",
                    "timestamp": now # Retained for risk_scoring compatibility
                })

                # 2. Mobility (user_id, date, time, latitude, longitude, geohash, has_contact, exposure_score, daily_exposure, total_detections, close_contacts)
                has_contact = 1 if contact_device else 0
                mobility_batch.append({
                    "user_id": device.replace("live_", "user_"),
                    "date": date_str,
                    "time": time_str,
                    "latitude": lat,
                    "longitude": lon,
                    "geohash": gh,
                    "has_contact": has_contact,
                    "exposure_score": random.uniform(0, 100) if has_contact else random.uniform(0, 10),
                    "daily_exposure": random.uniform(0, 50),
                    "total_detections": random.randint(1, 10),
                    "close_contacts": random.randint(0, 5) if has_contact else 0,
                    "timestamp": now # Retained for risk_scoring compatibility
                })

                # 3. Vitals (device_id, date, time, latitude, longitude, geohash, temperature, temp_status, heartbeat, hr_status, movement, battery)
                if random.random() < 0.2 or device in ANOMALOUS_DEVICES:
                    temp = random.uniform(36.0, 37.5)
                    hr = random.randint(60, 90)

                    if device in ANOMALOUS_DEVICES:
                        temp = random.uniform(38.5, 40.0)
                        hr = random.randint(100, 130)

                    vitals_batch.append({
                        "device_id": device,
                        "date": date_str,
                        "time": time_str,
                        "latitude": lat,
                        "longitude": lon,
                        "geohash": gh,
                        "temperature": temp,
                        "temp_status": "high" if temp >= 38.0 else "low" if temp < 36.5 else "normal",
                        "heartbeat": hr,
                        "hr_status": "high" if hr >= 100 else "normal",
                        "movement": random.choice([0, 1]),
                        "battery": random.uniform(20, 100),
                        "timestamp": now # Retained for risk_scoring compatibility
                    })

            if contacts_batch:
                await db.contacts.insert_many(contacts_batch)
            if mobility_batch:
                await db.mobility.insert_many(mobility_batch)
            if vitals_batch:
                await db.vitals.insert_many(vitals_batch)

        except Exception as e:
            print(f"[Live Simulation Error] {e}")

        # Wait 5 seconds before next burst
        await asyncio.sleep(5)
