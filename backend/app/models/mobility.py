from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MobilityRecord(BaseModel):
    user_id: str
    timestamp: datetime
    latitude: float
    longitude: float
    geohash: str
    has_contact: bool = False
    exposure_score: Optional[float] = None
    daily_exposure: Optional[float] = None
    total_detections: Optional[float] = None
    close_contacts: Optional[float] = None
