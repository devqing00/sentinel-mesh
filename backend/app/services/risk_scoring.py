import os
from datetime import datetime, timezone
from collections import defaultdict
from app.db import get_database


import asyncio

async def score_all_users(start_date=None, end_date=None, split_date=None, force_refresh=False):
    """
    Generalized Risk Trajectory Engine.
    Runs over all users in the dataset, computing their risk score in Phase 1 (before split_date)
    and Phase 2 (after split_date), and outputs a ranked table of their trajectory shift.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    
    # Check MongoDB persistent cache first (L2)
    cache_doc = await db.system_cache.find_one({"_id": "ranked_users_cache"})
    if cache_doc and not force_refresh:
        # Assuming timestamps are stored correctly, we can check TTL
        cache_ts = cache_doc.get("timestamp")
        if cache_ts:
            if isinstance(cache_ts, str):
                cache_ts = datetime.fromisoformat(cache_ts.replace("Z", "+00:00"))
            if cache_ts.tzinfo is None:
                cache_ts = cache_ts.replace(tzinfo=timezone.utc)
            if (now - cache_ts).total_seconds() < 300: # 5 mins TTL
                return cache_doc.get("data", [])

    # Defaults for the Hackathon demo dataset (Oct 2023 to Jun 2024)
    # Using March 1st 2024 as the split to show "recent escalation" vs "historical baseline"
    if not split_date:
        split_date = datetime(2024, 3, 1, tzinfo=timezone.utc)
    if isinstance(split_date, str):
        split_date = datetime.fromisoformat(split_date.replace("Z", "+00:00"))

    TEMP_THRESHOLD = float(os.getenv("TEMP_THRESHOLD", "38.0"))
    HR_THRESHOLD = int(os.getenv("HR_THRESHOLD", "100"))

    # Track metrics per user per phase
    # user_id -> {"phase1": metrics, "phase2": metrics, "geo": set()}
    user_metrics = defaultdict(lambda: {
        "phase1": {"vitals_anomalies": 0, "contacts": 0, "exposure_sum": 0, "exposure_count": 0, "devices": set()},
        "phase2": {"vitals_anomalies": 0, "contacts": 0, "exposure_sum": 0, "exposure_count": 0, "devices": set()},
        "geohashes": defaultdict(int)
    })

    # 1. Process Mobility Data
    mob_cursor = db.mobility.find({})
    async for doc in mob_cursor:
        uid = doc["user_id"]
        # Convert doc timestamp to aware datetime if it's naive
        ts = doc["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        
        phase = "phase1" if ts < split_date else "phase2"
        
        if doc.get("exposure_score"):
            user_metrics[uid][phase]["exposure_sum"] += doc["exposure_score"]
            user_metrics[uid][phase]["exposure_count"] += 1
            
        if doc.get("geohash"):
            user_metrics[uid]["geohashes"][doc["geohash"][:4]] += 1

    # 2. Process Contact Data
    contact_cursor = db.contacts.find({})
    async for doc in contact_cursor:
        uid = doc["user_id"]
        ts = doc["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
            
        phase = "phase1" if ts < split_date else "phase2"
        user_metrics[uid][phase]["contacts"] += 1
        
        if doc.get("geohash"):
            user_metrics[uid]["geohashes"][doc["geohash"][:4]] += 1

    # 3. Process Vitals Anomalies
    vitals_cursor = db.vitals.find({
        "$or": [
            {"temperature": {"$gte": TEMP_THRESHOLD}},
            {"temp_status": "high"},
            {"heartbeat": {"$gt": HR_THRESHOLD}},
            {"hr_status": "high"},
        ]
    })
    async for doc in vitals_cursor:
        mac = doc["device_id"]
        # Map device_id to user_id (e.g. D009 -> U009)
        uid = mac.replace("D", "U")
        
        ts = doc["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
            
        phase = "phase1" if ts < split_date else "phase2"
        user_metrics[uid][phase]["vitals_anomalies"] += 1

    # 4. Compute Scores via ML Pipeline
    import joblib
    import pandas as pd
    
    model_path = os.path.join(os.path.dirname(__file__), "sentinel_risk_model.pkl")
    try:
        model = joblib.load(model_path)
    except Exception as e:
        print(f"Error loading ML model: {e}")
        model = None

    ranked_table = []
    
    for uid, data in user_metrics.items():
        # Feature extraction
        p1_vitals = data["phase1"]["vitals_anomalies"]
        p1_contacts = data["phase1"]["contacts"]
        p2_vitals = data["phase2"]["vitals_anomalies"]
        p2_contacts = data["phase2"]["contacts"]
        
        total_vitals = p1_vitals + p2_vitals
        total_contacts = p1_contacts + p2_contacts
        
        # Simple trajectory shift proxy for inference
        traj_shift = len(data["geohashes"]) * 10
        
        if model:
            # Predict Phase 1 Risk (Historical Baseline)
            X1 = pd.DataFrame([{
                'vitals_anomalies': p1_vitals,
                'direct_contacts': p1_contacts,
                'trajectory_shift': traj_shift
            }])
            p1_risk = float(model.predict(X1)[0])
            
            # Predict Current Cumulative Risk
            X2 = pd.DataFrame([{
                'vitals_anomalies': total_vitals,
                'direct_contacts': total_contacts,
                'trajectory_shift': traj_shift
            }])
            p2_risk = float(model.predict(X2)[0])
            
            confidence = 0.94 # Static for now
        else:
            # Fallback to mock
            p1_risk = min(100.0, p1_vitals * 5 + p1_contacts * 2)
            p2_risk = min(100.0, total_vitals * 5 + total_contacts * 2)
            confidence = 0.5
            
        shift = p2_risk - p1_risk
        
        # Map forecast to UI category
        if p2_risk >= 70 and shift > 5:
            category = "escalating"
        elif p2_risk >= 70:
            category = "persistently-high"
        elif p1_risk >= 70 and shift < -5:
            category = "recovering"
        elif p2_risk < 40:
            category = "low-risk"
        else:
            category = "stable"
            
        # Top Geo Location
        top_geo = None
        if data["geohashes"]:
            top_geo = max(data["geohashes"].items(), key=lambda x: x[1])[0]
            
        ranked_table.append({
            "user_id": uid,
            "phase1_risk": round(p1_risk, 1),
            "phase2_risk": round(p2_risk, 1),
            "trajectory_shift": round(shift, 1),
            "category": category,
            "top_geo": top_geo,
            "total_vitals_anomalies": total_vitals,
            "total_contacts": total_contacts,
            "ml_confidence": confidence
        })

    # Sort by descending current risk and then trajectory shift
    ranked_table.sort(key=lambda x: (x["phase2_risk"], x["trajectory_shift"]), reverse=True)
    
    await db.system_cache.update_one(
        {"_id": "ranked_users_cache"},
        {"$set": {
            "data": ranked_table,
            "timestamp": now.isoformat()
        }},
        upsert=True
    )
    
    return ranked_table


# Keep legacy functions for backwards compatibility until frontend is fully migrated
async def calculate_community_risks():
    return []

async def get_anomalous_vitals_summary():
    return []
