from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class AuditLogEntry(BaseModel):
    timestamp: datetime
    cluster_id: str
    risk_score: float
    trigger_reason: str
    contributing_device_ids: List[str] = []
    contributing_contact_events: int = 0
    contributing_vitals_records: int = 0
    recipient: str = ""
    payload_sent: Optional[Dict[str, Any]] = None
    delivery_status: str = "simulated"  # "simulated", "sent", "failed"
    notification_type: str = "email"  # "email", "sms", "both"
