import os
import pandas as pd
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.db import get_database

router = APIRouter(prefix="/api/ingest", tags=["ingest"])

# Path to CSV files (mounted in container or local)
DATA_DIR = os.getenv("DATA_DIR", "/data")


def _parse_datetime(date_str: str, time_str: str) -> datetime:
    """Combine separate date and time columns into a datetime object."""
    return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M:%S")


@router.post("/mobility")
async def ingest_mobility():
    """Ingest mobility.csv into MongoDB."""
    db = get_database()
    csv_path = os.path.join(DATA_DIR, "mobility.csv")
    
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail=f"mobility.csv not found at {csv_path}")
    
    df = pd.read_csv(csv_path)
    
    records = []
    for _, row in df.iterrows():
        records.append({
            "user_id": str(row["user_id"]),
            "timestamp": _parse_datetime(str(row["date"]), str(row["time"])),
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "geohash": str(row["geohash"]),
            "has_contact": bool(row["has_contact"]) if row["has_contact"] != "False" else row["has_contact"] == "True",
            "exposure_score": float(row["exposure_score"]) if pd.notna(row.get("exposure_score")) else None,
            "daily_exposure": float(row["daily_exposure"]) if pd.notna(row.get("daily_exposure")) else None,
            "total_detections": float(row["total_detections"]) if pd.notna(row.get("total_detections")) else None,
            "close_contacts": float(row["close_contacts"]) if pd.notna(row.get("close_contacts")) else None,
        })
    
    # Clear existing and insert
    await db.mobility.delete_many({})
    if records:
        await db.mobility.insert_many(records)
    
    # Create indexes
    await db.mobility.create_index("user_id")
    await db.mobility.create_index("geohash")
    await db.mobility.create_index("timestamp")
    
    return {"status": "ok", "collection": "mobility", "records_inserted": len(records)}


@router.post("/contacts")
async def ingest_contacts():
    """Ingest contact_tracing.csv into MongoDB."""
    db = get_database()
    csv_path = os.path.join(DATA_DIR, "contact_tracing.csv")
    
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail=f"contact_tracing.csv not found at {csv_path}")
    
    df = pd.read_csv(csv_path)
    
    records = []
    for _, row in df.iterrows():
        rssi_val = float(row["rssi"]) if pd.notna(row.get("rssi")) else None
        records.append({
            "user_id": str(row["user_id"]),
            "timestamp": _parse_datetime(str(row["date"]), str(row["time"])),
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "geohash": str(row["geohash"]),
            "mac": str(row["mac"]),
            "rssi": rssi_val,
            "proximity": str(row["proximity"]) if pd.notna(row.get("proximity")) else "unscored",
        })
    
    # Clear existing and insert in batches
    await db.contacts.delete_many({})
    batch_size = 5000
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        await db.contacts.insert_many(batch)
    
    # Create indexes
    await db.contacts.create_index("user_id")
    await db.contacts.create_index("mac")
    await db.contacts.create_index("geohash")
    await db.contacts.create_index("timestamp")
    await db.contacts.create_index("proximity")
    
    return {"status": "ok", "collection": "contacts", "records_inserted": len(records)}


@router.post("/vitals")
async def ingest_vitals():
    """Ingest vitals.csv into MongoDB."""
    db = get_database()
    csv_path = os.path.join(DATA_DIR, "vitals.csv")
    
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail=f"vitals.csv not found at {csv_path}")
    
    df = pd.read_csv(csv_path)
    
    records = []
    for _, row in df.iterrows():
        records.append({
            "device_id": str(row["device_id"]),
            "timestamp": _parse_datetime(str(row["date"]), str(row["time"])),
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "geohash": str(row["geohash"]),
            "temperature": float(row["temperature"]),
            "temp_status": str(row["temp_status"]),
            "heartbeat": float(row["heartbeat"]),
            "hr_status": str(row["hr_status"]),
            "movement": float(row["movement"]),
            "battery": float(row["battery"]),
        })
    
    # Clear existing and insert
    await db.vitals.delete_many({})
    if records:
        await db.vitals.insert_many(records)
    
    # Create indexes
    await db.vitals.create_index("device_id")
    await db.vitals.create_index("geohash")
    await db.vitals.create_index("timestamp")
    await db.vitals.create_index("temp_status")
    await db.vitals.create_index("hr_status")
    await db.vitals.create_index("battery")
    
    return {"status": "ok", "collection": "vitals", "records_inserted": len(records)}


@router.post("/clear_all")
async def clear_all_collections():
    """Clear anomalies and audit logs manually"""
    db = get_database()
    await db.anomalies.delete_many({})
    await db.audit_log.delete_many({})
    return {"status": "ok", "message": "Anomalies and Audit logs cleared"}

@router.post("/all")
async def ingest_all():
    """Seed all three datasets from CSV files on disk."""
    results = {}
    
    try:
        results["mobility"] = await ingest_mobility()
    except Exception as e:
        results["mobility"] = {"status": "error", "detail": str(e)}
    
    try:
        results["contacts"] = await ingest_contacts()
    except Exception as e:
        results["contacts"] = {"status": "error", "detail": str(e)}
    
    try:
        results["vitals"] = await ingest_vitals()
    except Exception as e:
        results["vitals"] = {"status": "error", "detail": str(e)}
    
    return {
        "status": "ok",
        "results": results,
        "summary": {
            "mobility": results.get("mobility", {}).get("records_inserted", 0),
            "contacts": results.get("contacts", {}).get("records_inserted", 0),
            "vitals": results.get("vitals", {}).get("records_inserted", 0),
        }
    }


@router.get("/stats")
async def get_ingestion_stats():
    """Get counts for all collections."""
    db = get_database()
    return {
        "mobility": await db.mobility.count_documents({}),
        "contacts": await db.contacts.count_documents({}),
        "vitals": await db.vitals.count_documents({}),
        "audit_log": await db.audit_log.count_documents({}),
    }
