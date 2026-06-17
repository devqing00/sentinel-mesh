from datetime import datetime
from app.db import get_database


async def generate_sormas_payload(cluster_id: str):
    """
    Generate a SORMAS/eIDSR-compatible case notification payload
    using real data from the cluster.
    """
    db = get_database()

    # Get vitals anomalies for this cluster
    anomalies = []
    cursor = db.vitals.find({
        "geohash": {"$regex": f"^{cluster_id[:5]}"},
        "$or": [
            {"temp_status": "high"},
            {"hr_status": "high"},
            {"temperature": {"$gte": 38.0}},
            {"heartbeat": {"$gt": 100}},
        ]
    }).limit(50)

    contributing_devices = set()
    symptoms = set()
    max_temp = 0
    max_hr = 0
    lat, lon = 0, 0

    async for doc in cursor:
        contributing_devices.add(doc["device_id"])
        if doc.get("temperature", 0) >= 38.0 or doc.get("temp_status") == "high":
            symptoms.add("Fever")
            max_temp = max(max_temp, doc.get("temperature", 0))
        if doc.get("heartbeat", 0) > 100 or doc.get("hr_status") == "high":
            symptoms.add("Elevated Heart Rate")
            max_hr = max(max_hr, doc.get("heartbeat", 0))
        lat = doc.get("latitude", lat)
        lon = doc.get("longitude", lon)

    # Get contact chain size
    contact_count = await db.contacts.count_documents({
        "mac": {"$in": list(contributing_devices)}
    }) if contributing_devices else 0

    # Map geohash to approximate region
    region_map = {
        "s179s": "Ondo State, Nigeria",
        "s179m": "Ondo State (Akure Area), Nigeria",
        "s179k": "Ondo State (Southern), Nigeria",
        "s0uyx": "Delta/Edo State, Nigeria",
        "s1quw": "Nasarawa State, Nigeria",
        "s1quy": "Nasarawa State (Northern), Nigeria",
        "s177k": "Kwara/Kogi State, Nigeria",
    }
    region = region_map.get(cluster_id[:5], "Nigeria (Unknown LGA)")

    return {
        "reportDate": datetime.utcnow().isoformat(),
        "region": region,
        "district": cluster_id,
        "diseaseDetails": "Suspected febrile illness — anomalous temperature and/or heart rate detected via IoT wearable surveillance",
        "symptoms": list(symptoms) if symptoms else ["Unspecified anomaly"],
        "maxTemperature": max_temp,
        "maxHeartRate": max_hr,
        "reportingUser": "SentinelMesh_Automated_System",
        "caseStatus": "SUSPECT",
        "contributingDevices": list(contributing_devices),
        "contactChainSize": contact_count,
        "geohash": cluster_id,
        "coordinates": {"latitude": lat, "longitude": lon},
        "dataSource": "Tracy IoT Wearable Mesh Network",
        "confidenceLevel": "AUTOMATED_DETECTION",
    }
