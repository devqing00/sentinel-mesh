import asyncio
import random
import uuid
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from app.websocket import manager

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/sentinelmesh")

DEVICES = [f"live_{i:03d}_{uuid.uuid4().hex[:6]}" for i in range(50)]
ANOMALOUS_DEVICES = DEVICES[:3] # Consistently anomalous devices

async def device_simulation_task(db, device, base_lat, base_lon):
    """Independent background task for a single device simulating spontaneous data pushes."""
    print(f"[Device {device}] Simulation started.")
    
    while True:
        try:
            # Sleep spontaneously but fast so it "gushes"
            sleep_time = random.uniform(0.1, 1.5)
            await asyncio.sleep(sleep_time)

            now = datetime.utcnow()
            date_str = now.strftime("%Y-%m-%d")
            time_str = now.strftime("%H:%M:%S")

            lat = base_lat + random.uniform(-0.02, 0.02)
            lon = base_lon + random.uniform(-0.02, 0.02)
            gh = f"{lat:.3f},{lon:.3f}"

            contact_device = random.choice(DEVICES) if random.random() < 0.2 else None
            has_contact = 1 if contact_device else 0

            # Generate Contacts
            contact_doc = {
                "user_id": device.replace("live_", "user_"),
                "date": date_str,
                "time": time_str,
                "latitude": lat,
                "longitude": lon,
                "geohash": gh,
                "mac": contact_device if contact_device else "00:00:00:00:00:00",
                "rssi": random.uniform(-90, -40) if contact_device else None,
                "proximity": "close" if contact_device else "none",
                "timestamp": now
            }
            await db.contacts.insert_one(contact_doc)

            # Generate Mobility
            mobility_doc = {
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
                "timestamp": now
            }
            await db.mobility.insert_one(mobility_doc)

            # Generate Vitals
            is_anomalous = (device in ANOMALOUS_DEVICES) or (random.random() < 0.05)
            
            temp = random.uniform(38.5, 40.0) if is_anomalous else random.uniform(36.0, 37.5)
            hr = random.randint(100, 130) if is_anomalous else random.randint(60, 90)
            temp_status = "high" if temp >= 38.0 else "low" if temp < 36.5 else "normal"
            hr_status = "high" if hr >= 100 else "normal"

            vitals_doc = {
                "device_id": device,
                "date": date_str,
                "time": time_str,
                "latitude": lat,
                "longitude": lon,
                "geohash": gh,
                "temperature": temp,
                "temp_status": temp_status,
                "heartbeat": hr,
                "hr_status": hr_status,
                "movement": random.choice([0, 1]),
                "battery": random.uniform(20, 100),
                "timestamp": now
            }
            await db.vitals.insert_one(vitals_doc)

            # Alert triggering via WebSocket
            if is_anomalous and manager.active_connections:
                alert_payload = {
                    "type": "new_alert",
                    "data": {
                        "device_id": device,
                        "temperature": round(temp, 1),
                        "heartbeat": hr,
                        "latitude": round(lat, 5),
                        "longitude": round(lon, 5),
                        "message": f"Critical vitals detected for {device}",
                        "timestamp": now.isoformat()
                    }
                }
                await manager.broadcast(alert_payload)
            
            # Increment global activity
            global global_activity_counter
            global_activity_counter += 1

        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Device {device} Error] {e}")


global_activity_counter = 0

async def activity_ticker_task():
    """Broadcasts the real-time activity count per second."""
    global global_activity_counter
    while True:
        try:
            await asyncio.sleep(1.0)
            count = global_activity_counter
            global_activity_counter = 0
            
            if manager.active_connections:
                await manager.broadcast({
                    "type": "activity_tick",
                    "data": {
                        "activity": count,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                })
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Activity Ticker Error] {e}")

async def live_simulation_loop():
    """Main orchestrator for live simulation tasks."""
    client = AsyncIOMotorClient(MONGO_URI)
    db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0]
    if not db_name or db_name == "localhost:27017":
        db_name = "sentinelmesh"
    db = client[db_name]

    print("[Live Simulation] Orchestrating spontaneous device connections...")

    base_lat = 7.84
    base_lon = 9.77

    tasks = []
    for device in DEVICES:
        tasks.append(asyncio.create_task(device_simulation_task(db, device, base_lat, base_lon)))
    
    tasks.append(asyncio.create_task(activity_ticker_task()))

    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        for t in tasks:
            t.cancel()
        print("[Live Simulation] Stopped.")

_simulation_task = None

async def start_simulation():
    global _simulation_task
    if _simulation_task is None or _simulation_task.done():
        _simulation_task = asyncio.create_task(live_simulation_loop())
        return {"status": "started", "message": "Simulation started successfully"}
    return {"status": "running", "message": "Simulation is already running"}

async def stop_simulation():
    global _simulation_task
    if _simulation_task and not _simulation_task.done():
        _simulation_task.cancel()
        try:
            await _simulation_task
        except asyncio.CancelledError:
            pass
    _simulation_task = None
    return {"status": "stopped", "message": "Simulation stopped successfully"}
