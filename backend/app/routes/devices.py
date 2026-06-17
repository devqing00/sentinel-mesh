from fastapi import APIRouter, Depends
from app.services.battery_predictor import get_battery_predictions
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/api/devices", tags=["devices"])

@router.get("/health")
async def get_devices_health(user: dict = Depends(get_current_user)):
    return await get_battery_predictions()
