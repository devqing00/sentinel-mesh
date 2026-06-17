from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class CommunityRiskScore(BaseModel):
    cluster_id: str
    lat: float
    lon: float
    risk_score: float
    contributing_device_count: int
    anomalous_devices: List[str] = []
    contact_count: int = 0
    last_updated: datetime
