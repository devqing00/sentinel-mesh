from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from datetime import datetime
from app.services.battery_predictor import get_battery_predictions
from app.dependencies.auth import get_current_user
from app.websocket import manager
from app.services.live_simulation import start_simulation, stop_simulation

router = APIRouter(prefix="/api/devices", tags=["devices"])

@router.post("/simulation/start")
async def api_start_simulation():
    return await start_simulation()

from app.routes.ingest import clear_all_collections, ingest_all

@router.post("/simulation/stop")
async def api_stop_simulation():
    res = await stop_simulation()
    
    # Reset DB to clean slate in background to prevent HTTP timeouts
    async def reset_db():
        try:
            await clear_all_collections()
            await ingest_all()
        except Exception as e:
            print(f"[Simulation Stop Error] DB reset failed: {e}")
            
    import asyncio
    asyncio.create_task(reset_db())
    return res

class PingData(BaseModel):
    user_id: str
    heart_rate: float
    temperature: float
    spo2: float
    steps: int
    nearby_contacts: List[str]

@router.post("/ping")
async def device_ping(data: PingData):
    # Simple risk analysis for the simulator
    is_anomaly = data.heart_rate > 100 or data.temperature > 38.0
    dual_anomaly = data.heart_rate > 100 and data.temperature > 38.0
    risk_tier = "CRITICAL" if dual_anomaly else "HIGH" if is_anomaly else "MODERATE" if data.heart_rate > 85 else "LOW"
    
    analysis = {
        "risk_tier": risk_tier,
        "is_anomaly": is_anomaly,
        "dual_anomaly": dual_anomaly,
        "alert_severity": risk_tier,
        "cluster": "s179",
        "nearby_contacts_registered": len(data.nearby_contacts)
    }

    if is_anomaly and manager.active_connections:
        await manager.broadcast({
            "type": "new_alert",
            "data": {
                "device_id": data.user_id,
                "temperature": round(data.temperature, 1),
                "heartbeat": round(data.heart_rate, 1),
                "latitude": 7.84,
                "longitude": 9.77,
                "message": f"Critical vitals detected for {data.user_id}",
                "timestamp": datetime.utcnow().isoformat()
            }
        })
    
    return {"status": "ok", "analysis": analysis}

@router.get("/health")
async def get_devices_health(user: dict = Depends(get_current_user)):
    return await get_battery_predictions()
