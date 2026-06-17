import os
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import json
from groq import AsyncGroq
from app.db import get_database
from app.services.risk_scoring import score_all_users
from app.dependencies.auth import get_current_user
from firebase_admin import auth as firebase_auth
from app.websocket import manager

router = APIRouter(prefix="/api/risk", tags=["risk"])

class AnalysisRequest(BaseModel):
    split_date: Optional[str] = "2024-03-01T00:00:00Z"

@router.post("/run-analysis")
async def run_analysis(req: AnalysisRequest, user: dict = Depends(get_current_user)):
    """
    Triggers the full pipeline live. Recomputes all scores across the cohort
    and generates a real-time AI Intelligence Briefing.
    """
    # 1. Run the core trajectory engine
    ranked_table = await score_all_users(split_date=req.split_date)
    
    # 2. Extract summary stats for the AI Briefing
    escalating_count = sum(1 for u in ranked_table if u["category"] == "escalating")
    persistently_high_count = sum(1 for u in ranked_table if u["category"] == "persistently-high")
    
    top_escalating = None
    if escalating_count > 0:
        top_escalating = next((u for u in ranked_table if u["category"] == "escalating"), None)
        
    hotspots = {}
    for u in ranked_table:
        if u["category"] in ["escalating", "persistently-high"] and u["top_geo"]:
            hotspots[u["top_geo"]] = hotspots.get(u["top_geo"], 0) + 1
            
    dominant_hotspot = max(hotspots.items(), key=lambda x: x[1])[0] if hotspots else "None"
    
    # 3. Generate AI Intelligence Briefing via Groq
    briefing = "AI Briefing unavailable (No API Key)"
    api_key = os.getenv("GROQ_API_KEY")
    
    if api_key and top_escalating:
        try:
            client = AsyncGroq(api_key=api_key)
            prompt = f"""
            You are the Sentinel Mesh AI Analyst reporting to the NCDC (Nigeria Centre for Disease Control).
            Write a 2-sentence natural-language intelligence briefing based on the following real-time data run:
            
            - {escalating_count} users show sharp risk escalation this period.
            - {persistently_high_count} users remain persistently high risk.
            - The most significant escalating case is user {top_escalating['user_id']} with a trajectory shift of +{top_escalating['trajectory_shift']}% and {top_escalating['vitals_anomalies_p2']} recent vitals anomalies.
            - Region {dominant_hotspot} remains the dominant hotspot.
            
            Keep it professional, urgent, and concise. Do not use markdown.
            """
            
            completion = await client.chat.completions.create(
                model="llama3-8b-8192",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=150
            )
            briefing = completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"[Groq Error] {e}")
            briefing = f"Analysis complete: {escalating_count} users escalating. Top concern: {top_escalating['user_id']}."
    elif top_escalating:
        briefing = f"Analysis complete: {escalating_count} users escalating. Top concern: {top_escalating['user_id']} in region {dominant_hotspot}."
        
    return {
        "status": "success",
        "total_users_scored": len(ranked_table),
        "briefing": briefing,
        "ranked_table": ranked_table
    }



@router.get("/ranked-table")
async def get_ranked_table(user: dict = Depends(get_current_user)):
    """Fetch ranked table. Uses DB persistent L2 cache."""
    ranked_table = await score_all_users()
    return {"ranked_table": ranked_table, "cached": True}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(None)):
    """WebSocket endpoint for real-time risk data streaming."""
    # Authenticate via token query param
    if not token:
        await websocket.close(code=1008)
        return
        
    if os.getenv("FIREBASE_MOCK_AUTH", "true").lower() == "true" and token == "mock-token":
        # Accept mock
        pass
    else:
        try:
            firebase_auth.verify_id_token(token)
        except Exception:
            await websocket.close(code=1008)
            return

    await manager.connect(websocket)
    db = get_database()
    try:
        while True:
            try:
                # Check for cache hit
                cache_doc = await db.system_cache.find_one({"_id": "ranked_users_cache"})
                ranked_table = []
                
                if cache_doc and "data" in cache_doc:
                    ranked_table = cache_doc["data"]
                
                await websocket.send_json({"type": "ranked_table", "data": ranked_table})
                await asyncio.sleep(2)
            except (Exception, WebSocketDisconnect):
                break
    except Exception:
        pass
    finally:
        manager.disconnect(websocket)


@router.get("/user/{user_id}")
async def get_user_detail(user_id: str, user: dict = Depends(get_current_user)):
    """
    Full profile for a single user: their vitals, contacts, mobility, and risk factors.
    Used to power the individual detail modal.
    """
    db = get_database()
    TEMP_THRESHOLD = float(os.getenv("TEMP_THRESHOLD", "38.0"))
    HR_THRESHOLD = int(os.getenv("HR_THRESHOLD", "100"))

    # 1. Their contact/device records
    contacts_cursor = db.contacts.find({"user_id": user_id}).sort("timestamp", -1).limit(200)
    contact_docs = []
    mac_set = set()
    async for doc in contacts_cursor:
        doc.pop("_id", None)
        if doc.get("timestamp"): doc["timestamp"] = doc["timestamp"].isoformat()
        contact_docs.append(doc)
        if doc.get("mac"): mac_set.add(doc["mac"])

    # 2. Vitals for their linked devices
    vitals_docs = []
    if mac_set:
        vitals_cursor = db.vitals.find(
            {"device_id": {"$in": list(mac_set)}}
        ).sort("timestamp", -1).limit(100)
        async for doc in vitals_cursor:
            doc.pop("_id", None)
            if doc.get("timestamp"): doc["timestamp"] = doc["timestamp"].isoformat()
            vitals_docs.append(doc)

    # 3. Anomalous vitals specifically
    anomalous = [v for v in vitals_docs if (
        v.get("temperature", 0) >= TEMP_THRESHOLD or
        v.get("heartbeat", 0) > HR_THRESHOLD or
        v.get("temp_status") == "high" or
        v.get("hr_status") == "high"
    )]

    # 4. Mobility / location data
    mobility_cursor = db.mobility.find({"user_id": user_id}).sort("timestamp", -1).limit(50)
    mobility_docs = []
    async for doc in mobility_cursor:
        doc.pop("_id", None)
        if doc.get("timestamp"): doc["timestamp"] = doc["timestamp"].isoformat()
        mobility_docs.append(doc)

    # 5. Other users who shared proximity with this user's devices
    exposed_users = set()
    for c in contact_docs:
        if c.get("user_id") and c["user_id"] != user_id:
            exposed_users.add(c["user_id"])

    # 6. Find their ranking from cache or recompute
    ranked_entry = None
    ranked_cache = await score_all_users()
    for entry in ranked_cache:
        if entry["user_id"] == user_id:
            ranked_entry = entry
            break

    # 7. Build risk factor breakdown
    risk_factors = []
    if anomalous:
        avg_temp = sum(v.get("temperature", 0) for v in anomalous) / len(anomalous)
        avg_hr = sum(v.get("heartbeat", 0) for v in anomalous) / len(anomalous)
        risk_factors.append(f"{len(anomalous)} vitals readings exceeded safe thresholds "
                            f"(avg temp: {avg_temp:.1f}°C, avg HR: {avg_hr:.0f} bpm)")
    if contact_docs:
        close_contacts = [c for c in contact_docs if c.get("proximity") == "close"]
        risk_factors.append(f"{len(contact_docs)} total contact events recorded, "
                            f"{len(close_contacts)} classified as close proximity")
    if len(exposed_users) > 0:
        risk_factors.append(f"Shared contact events with {len(exposed_users)} other individuals")
    if mobility_docs:
        geohashes = list({m.get("geohash", "")[:4] for m in mobility_docs if m.get("geohash")})
        risk_factors.append(f"Movement recorded across {len(geohashes)} geographic regions: "
                            f"{', '.join(geohashes[:5])}")
    if ranked_entry:
        shift = ranked_entry.get("trajectory_shift", 0)
        if shift > 0:
            risk_factors.append(f"Risk trajectory increased by +{shift:.1f}% between observation periods")

    return {
        "user_id": user_id,
        "ranked_entry": ranked_entry,
        "risk_factors": risk_factors,
        "vitals": vitals_docs[:30],
        "anomalous_vitals": anomalous[:20],
        "contacts": contact_docs[:30],
        "exposed_users": list(exposed_users)[:20],
        "mobility": mobility_docs[:20],
        "mac_addresses": list(mac_set),
    }



@router.get("/activity")
async def get_activity_trend(user: dict = Depends(get_current_user)):
    """Fetch real activity timeline from mobility collection."""
    db = get_database()
    
    pipeline = [
        {"$group": {
            "_id": {
                "year": {"$year": "$timestamp"},
                "month": {"$month": "$timestamp"},
                "day": {"$dayOfMonth": "$timestamp"}
            },
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id.year": -1, "_id.month": -1, "_id.day": -1}},
        {"$limit": 60}
    ]
    
    results = []
    try:
        cursor = db.mobility.aggregate(pipeline)
        async for doc in cursor:
            if not doc["_id"].get("year"):
                continue
            dt = datetime(doc["_id"]["year"], doc["_id"]["month"], doc["_id"]["day"])
            results.append({
                "date": dt.strftime("%a"),
                "fullDate": dt.strftime("%b %d"),
                "activity": doc["count"]
            })
    except Exception as e:
        print(f"[Activity Trend Error] {e}")
        
    # Reverse so oldest is first
    results.reverse()
    return {"trend": results}


# Keep legacy routes for backwards compatibility until frontend is fully migrated
@router.get("/communities")
async def get_communities(user: dict = Depends(get_current_user)):
    """Return real geohash-clustered community risks."""
    results = await calculate_community_risks()
    return results

@router.get("/anomalies")
async def get_anomalies(user: dict = Depends(get_current_user)):
    return []

async def calculate_community_risks():
    """Real community risk clustering from vitals + contacts data."""
    from collections import defaultdict
    db = get_database()
    TEMP_THRESHOLD = float(os.getenv("TEMP_THRESHOLD", "38.0"))
    HR_THRESHOLD = int(os.getenv("HR_THRESHOLD", "100"))

    # Group vitals by geohash prefix (4 chars = ~20km resolution)
    clusters: dict = defaultdict(lambda: {
        "devices": set(), "anomalous": set(),
        "lat_sum": 0.0, "lon_sum": 0.0, "coord_count": 0
    })

    contact_counts: dict = defaultdict(int)

    try:
        vitals_cursor = db.vitals.find({})
        async for doc in vitals_cursor:
            gh = (doc.get("geohash") or "")[:4]
            if not gh:
                continue
            did = doc.get("device_id", "")
            clusters[gh]["devices"].add(did)
            if (doc.get("temperature", 0) >= TEMP_THRESHOLD or
                    doc.get("heartbeat", 0) > HR_THRESHOLD or
                    doc.get("temp_status") == "high" or
                    doc.get("hr_status") == "high"):
                clusters[gh]["anomalous"].add(did)
            lat = doc.get("latitude") or doc.get("lat")
            lon = doc.get("longitude") or doc.get("lon")
            if lat and lon:
                clusters[gh]["lat_sum"] += lat
                clusters[gh]["lon_sum"] += lon
                clusters[gh]["coord_count"] += 1

        # Count contacts per cluster
        contacts_cursor = db.contacts.find({"proximity": "close"})
        async for doc in contacts_cursor:
            gh = (doc.get("geohash") or "")[:4]
            if gh:
                contact_counts[gh] += 1
    except Exception as e:
        print(f"[Community Risk DB Error] {e}")

    results = []
    for gh, data in clusters.items():
        device_count = len(data["devices"])
        anomalous_count = len(data["anomalous"])
        contact_count = contact_counts.get(gh, 0)
        coord_count = data["coord_count"] or 1

        # Risk score: anomaly ratio (60%) + contact pressure (40%)
        anomaly_ratio = anomalous_count / max(device_count, 1)
        contact_pressure = min(contact_count / 50.0, 1.0)
        risk_score = round(min(100.0, (anomaly_ratio * 60.0) + (contact_pressure * 40.0)), 1)

        if device_count < 2:
            continue  # Skip singleton clusters

        results.append({
            "cluster_id": gh,
            "lat": round(data["lat_sum"] / coord_count, 5),
            "lon": round(data["lon_sum"] / coord_count, 5),
            "risk_score": risk_score,
            "contributing_device_count": device_count,
            "anomalous_devices": list(data["anomalous"])[:10],
            "contact_count": contact_count,
        })

    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return results  # Return all clusters


async def get_anomalous_vitals_summary():
    return []
