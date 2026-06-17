from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.services.alert_generator import generate_multilingual_alerts
from app.services.notification_service import trigger_notification
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class AlertRequest(BaseModel):
    cluster_id: str


@router.post("/generate")
async def generate_alerts(req: AlertRequest, user: dict = Depends(get_current_user)):
    """Generate multilingual alerts for a cluster (preview only, no notification sent)."""
    alerts = await generate_multilingual_alerts(req.cluster_id)
    return {"alerts": alerts}


@router.post("/trigger/{cluster_id}")
async def trigger_alert(cluster_id: str, user: dict = Depends(get_current_user)):
    """
    DEMO CENTERPIECE: Trigger the full notification pipeline.
    Builds SORMAS payload, generates multilingual alerts, sends notification
    (or simulates), and logs to audit trail.
    """
    result = await trigger_notification(cluster_id)
    return result
