from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class VitalsRecord(BaseModel):
    device_id: str
    timestamp: datetime
    latitude: float
    longitude: float
    geohash: str
    temperature: float
    temp_status: str  # "low", "normal", "high"
    heartbeat: float
    hr_status: str  # "low", "normal", "high"
    movement: float  # 0.0 or 1.0
    battery: float  # 0-100
