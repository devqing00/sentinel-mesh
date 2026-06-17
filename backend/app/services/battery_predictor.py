from datetime import datetime
from app.db import get_database


async def get_battery_predictions():
    """
    Real battery prediction from vitals data:
    - Track per-device battery readings over time
    - Compute decline rate
    - Project hours to 0%
    - Flag devices needing kiosk visit
    """
    db = get_database()

    # Aggregate per-device battery info
    pipeline = [
        {"$match": {"battery": {"$exists": True, "$ne": None}}},
        {"$sort": {"timestamp": 1}},
        {"$group": {
            "_id": "$device_id",
            "readings": {"$push": {
                "battery": "$battery",
                "timestamp": "$timestamp",
                "movement": "$movement",
                "temperature": "$temperature",
                "heartbeat": "$heartbeat"
            }},
            "latest_battery": {"$last": "$battery"},
            "first_battery": {"$first": "$battery"},
            "latest_movement": {"$last": "$movement"},
            "last_seen": {"$last": "$timestamp"},
            "first_seen": {"$first": "$timestamp"},
            "reading_count": {"$sum": 1},
            "latest_temp": {"$last": "$temperature"},
            "latest_hr": {"$last": "$heartbeat"},
            "latest_temp_status": {"$last": "$temp_status"},
            "latest_hr_status": {"$last": "$hr_status"},
            "latest_geohash": {"$last": "$geohash"},
            "latest_lat": {"$last": "$latitude"},
            "latest_lon": {"$last": "$longitude"},
        }}
    ]

    cursor = db.vitals.aggregate(pipeline)

    results = []
    async for doc in cursor:
        device_id = doc["_id"]
        latest_battery = doc["latest_battery"]
        first_battery = doc["first_battery"]
        reading_count = doc["reading_count"]

        # Calculate decline rate
        if reading_count >= 2 and doc["first_seen"] and doc["last_seen"]:
            time_span = doc["last_seen"] - doc["first_seen"]
            hours_span = max(time_span.total_seconds() / 3600, 0.1)
            battery_drop = first_battery - latest_battery

            if battery_drop > 0:
                decline_rate = battery_drop / hours_span  # % per hour
                projected_hours = latest_battery / decline_rate if decline_rate > 0 else 999
            else:
                decline_rate = 0
                projected_hours = 999  # Not declining
        else:
            decline_rate = 0
            projected_hours = 999

        # Determine status
        if latest_battery <= 0:
            status = "dead"
        elif latest_battery < 10:
            status = "critical"
        elif latest_battery < 20 or projected_hours < 24:
            status = "needs_visit"
        else:
            status = "ok"

        # Check if device appears to be near charging (movement=0 and battery rising)
        near_charging = doc["latest_movement"] == 0 and latest_battery > first_battery

        results.append({
            "device_id": device_id,
            "battery_percent": latest_battery,
            "projected_hours_remaining": round(min(projected_hours, 999), 1),
            "decline_rate_per_hour": round(decline_rate, 2),
            "status": status,
            "last_seen": doc["last_seen"],
            "reading_count": reading_count,
            "near_charging": near_charging,
            "latest_temp": doc["latest_temp"],
            "latest_hr": doc["latest_hr"],
            "temp_status": doc["latest_temp_status"],
            "hr_status": doc["latest_hr_status"],
            "geohash": doc["latest_geohash"],
            "lat": doc["latest_lat"],
            "lon": doc["latest_lon"],
            "vitals_history": doc.get("readings", [])[-20:] # Only return the last 20 readings for the chart
        })

    # Sort: dead first, then critical, then needs_visit, then ok
    status_order = {"dead": 0, "critical": 1, "needs_visit": 2, "ok": 3}
    results.sort(key=lambda x: (status_order.get(x["status"], 4), x["battery_percent"]))

    return results
