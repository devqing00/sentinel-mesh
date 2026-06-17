import asyncio
import csv
import argparse
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/sentinelmesh")

async def ingest_csv(filepath: str):
    if not os.path.exists(filepath):
        print(f"Error: File {filepath} not found.")
        return

    client = AsyncIOMotorClient(MONGO_URI)
    db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0]
    if not db_name or db_name == "localhost:27017":
        db_name = "sentinelmesh"
    db = client[db_name]

    print("Clearing old data...")
    await db.contacts.delete_many({})
    await db.vitals.delete_many({})

    contacts_batch = []
    vitals_batch = []

    print(f"Reading from {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                # Provide a basic parse, fallback if format varies
                ts_str = row.get('timestamp', '')
                if ts_str.endswith('Z'):
                    ts_str = ts_str[:-1] + '+00:00'
                ts = datetime.fromisoformat(ts_str) if ts_str else datetime.utcnow()
                
                # Clamp year to 2026
                try:
                    ts = ts.replace(year=2026)
                except ValueError:
                    # In case of Feb 29 on a non-leap year (2026 is not a leap year), fallback to Feb 28
                    ts = ts.replace(year=2026, day=28)
                
                device_id = row.get('device_id')
                
                # Base location/contact
                if row.get('latitude') and row.get('longitude'):
                    lat = float(row['latitude'])
                    lon = float(row['longitude'])
                    contact_id = row.get('contact_device_id')
                    rssi_val = row.get('rssi')
                    rssi = float(rssi_val) if rssi_val else None
                    
                    contacts_batch.append({
                        "device_id": device_id,
                        "timestamp": ts,
                        "latitude": lat,
                        "longitude": lon,
                        "geohash": f"{lat:.3f},{lon:.3f}",
                        "contact_device_id": contact_id if contact_id else None,
                        "rssi": rssi
                    })
                
                # Vitals
                if row.get('body_temperature_c') or row.get('heart_rate_bpm'):
                    vitals_batch.append({
                        "device_id": device_id,
                        "timestamp": ts,
                        "body_temperature_c": float(row.get('body_temperature_c', 37.0)),
                        "heart_rate_bpm": int(row.get('heart_rate_bpm', 80)),
                        "movement_status": int(row.get('movement_status', 0)),
                        "battery_percent": float(row.get('battery_percent', 100.0))
                    })
            except Exception as e:
                pass # skip malformed in real data

    print(f"Parsed {len(contacts_batch)} contacts and {len(vitals_batch)} vitals.")
    
    if contacts_batch:
        await db.contacts.insert_many(contacts_batch)
        print("Contacts inserted.")
    
    if vitals_batch:
        await db.vitals.insert_many(vitals_batch)
        print("Vitals inserted.")
        
    vitals_percentage = (len(vitals_batch) / len(contacts_batch)) * 100 if contacts_batch else 0
    print(f"Vitals coverage validation: {vitals_percentage:.2f}% of contact records have vitals.")

    client.close()
    print("Ingestion complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest Tracy dataset CSV")
    parser.add_argument("--file", required=True, help="Path to the real Tracy CSV dataset")
    args = parser.parse_args()
    
    asyncio.run(ingest_csv(args.file))
