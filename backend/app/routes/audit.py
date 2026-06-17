from fastapi import APIRouter, Depends
from app.db import get_database
from app.services.risk_scoring import get_anomalous_vitals_summary
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/log")
async def get_audit_log(user: dict = Depends(get_current_user)):
    """Get all notification audit entries, most recent first."""
    db = get_database()
    cursor = db.audit_log.find({}).sort("timestamp", -1).limit(100)

    entries = []
    async for doc in cursor:
        doc.pop("_id", None)
        # Convert datetime for JSON serialization
        if doc.get("timestamp"):
            doc["timestamp"] = doc["timestamp"].isoformat()
        entries.append(doc)

    return {"entries": entries, "total": len(entries)}


@router.get("/explain/{cluster_id}")
async def explain_cluster_risk(cluster_id: str, user: dict = Depends(get_current_user)):
    """
    Human-readable breakdown of exactly why a cluster's risk score is what it is.
    Shows which vitals anomalies, contact chains, and mobility data contributed.
    """
    db = get_database()

    # 1. Get anomalous vitals in this cluster
    vitals_cursor = db.vitals.find({
        "geohash": {"$regex": f"^{cluster_id[:5]}"},
        "$or": [
            {"temp_status": "high"},
            {"hr_status": "high"},
            {"temperature": {"$gte": 38.0}},
            {"heartbeat": {"$gt": 100}},
        ]
    }).limit(50)

    anomalous_vitals = []
    anomalous_device_ids = set()
    async for doc in vitals_cursor:
        doc.pop("_id", None)
        if doc.get("timestamp"):
            doc["timestamp"] = doc["timestamp"].isoformat()
        anomalous_vitals.append(doc)
        anomalous_device_ids.add(doc["device_id"])

    # 2. Get contact events involving these devices
    contact_events = []
    if anomalous_device_ids:
        contact_cursor = db.contacts.find({
            "mac": {"$in": list(anomalous_device_ids)},
            "proximity": "close",
        }).limit(100)

        async for doc in contact_cursor:
            doc.pop("_id", None)
            if doc.get("timestamp"):
                doc["timestamp"] = doc["timestamp"].isoformat()
            contact_events.append(doc)

    # 3. Get unique users exposed
    exposed_users = set()
    for event in contact_events:
        exposed_users.add(event["user_id"])

    # 4. Build human-readable explanation
    explanations = []
    for v in anomalous_vitals:
        reasons = []
        if v.get("temperature", 0) >= 38.0 or v.get("temp_status") == "high":
            reasons.append(f"temperature {v.get('temperature', '?')}°C (status: {v.get('temp_status', '?')})")
        if v.get("heartbeat", 0) > 100 or v.get("hr_status") == "high":
            reasons.append(f"heart rate {v.get('heartbeat', '?')} bpm (status: {v.get('hr_status', '?')})")

        explanations.append(
            f"Device {v['device_id']} recorded anomalous readings: {', '.join(reasons)} "
            f"at geohash {v.get('geohash', '?')} on {v.get('timestamp', '?')}"
        )

    # 5. Get audit log entries for this cluster
    audit_cursor = db.audit_log.find({"cluster_id": cluster_id}).sort("timestamp", -1).limit(10)
    audit_entries = []
    async for doc in audit_cursor:
        doc.pop("_id", None)
        if doc.get("timestamp"):
            doc["timestamp"] = doc["timestamp"].isoformat()
        audit_entries.append(doc)

    return {
        "cluster_id": cluster_id,
        "summary": f"Cluster {cluster_id} has {len(anomalous_device_ids)} anomalous device(s) "
                   f"with {len(contact_events)} close-contact events involving "
                   f"{len(exposed_users)} unique users.",
        "anomalous_vitals": anomalous_vitals,
        "anomalous_device_ids": list(anomalous_device_ids),
        "contact_events_sample": contact_events[:20],
        "exposed_users": list(exposed_users),
        "explanations": explanations,
        "notification_history": audit_entries,
    }


@router.get("/anomalies")
async def get_all_anomalies(user: dict = Depends(get_current_user)):
    """Get a summary of all anomalous vitals across all clusters."""
    return await get_anomalous_vitals_summary()
