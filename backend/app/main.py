from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import asyncio
from app.db import connect_to_mongo, close_mongo_connection
from app.websocket import manager
from app.services.risk_scoring import score_all_users
from app.services.live_simulation import live_simulation_loop
from app.routes import ingest, risk, network, devices, alerts, export, audit, admin, ai, resources

async def broadcast_task():
    while True:
        await asyncio.sleep(15) # Broadcast every 15 seconds
        if manager.active_connections:
            try:
                ranked_table = await score_all_users()
                await manager.broadcast({"type": "ranked_table", "data": ranked_table})
            except Exception as e:
                print(f"[WebSocket Broadcast Error] {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    b_task = asyncio.create_task(broadcast_task())
    yield
    b_task.cancel()
    await close_mongo_connection()

app = FastAPI(
    title="Sentinel Mesh API",
    description="IoT Wearable Health Surveillance — Automated Early Warning System",
    version="1.0.0",
    lifespan=lifespan,
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(risk.router)
app.include_router(network.router)
app.include_router(devices.router)
app.include_router(alerts.router)
app.include_router(export.router)
app.include_router(audit.router)
app.include_router(admin.router)
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(resources.router, prefix="/api/resources", tags=["resources"])

@app.get("/")
async def root():
    return {
        "message": "Sentinel Mesh API is running",
        "version": "1.0.0",
        "endpoints": {
            "ingest": "/api/ingest/all",
            "risk": "/api/risk/communities",
            "network": "/api/network/graph",
            "devices": "/api/devices/health",
            "alerts": "/api/alerts/trigger/{cluster_id}",
            "audit": "/api/audit/log",
            "export": "/api/export/sormas/{cluster_id}",
            "stats": "/api/ingest/stats",
        }
    }
