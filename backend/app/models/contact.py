from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ContactRecord(BaseModel):
    user_id: str
    timestamp: datetime
    latitude: float
    longitude: float
    geohash: str
    mac: str  # detected device BLE MAC (D-prefix IDs)
    rssi: Optional[float] = None
    proximity: str = "unscored"  # "close" or "unscored"
