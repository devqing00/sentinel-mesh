import os
import json
from datetime import datetime
from app.db import get_database
from app.services.risk_scoring import calculate_community_risks
from app.services.sormas_export import generate_sormas_payload
from app.services.alert_generator import generate_multilingual_alerts


async def trigger_notification(cluster_id: str):
    """
    Full notification pipeline:
    1. Get risk data for the cluster
    2. Build SORMAS payload
    3. Generate multilingual alerts
    4. Attempt real notification (email/SMS) or fall back to simulated
    5. Log everything to audit trail
    """
    db = get_database()

    # 1. Get risk data
    communities = await calculate_community_risks()
    cluster_data = None
    for c in communities:
        if c["cluster_id"] == cluster_id:
            cluster_data = c
            break

    if not cluster_data:
        # Still allow trigger even if cluster isn't currently high-risk
        cluster_data = {
            "cluster_id": cluster_id,
            "risk_score": 0,
            "contributing_device_count": 0,
            "anomalous_devices": [],
            "contact_count": 0,
        }

    # 2. Build SORMAS payload
    sormas_payload = await generate_sormas_payload(cluster_id)

    # 3. Generate multilingual alerts
    alerts = await generate_multilingual_alerts(cluster_id)

    # 4. Attempt notification delivery
    delivery_status = "simulated"
    recipient = os.getenv("NOTIFY_EMAIL_TO", "demo-ncdc-desk@sentinel-mesh.local")
    notification_type = "email"

    # Try real email if credentials are available
    email_key = os.getenv("NOTIFY_EMAIL_PROVIDER_API_KEY")
    if email_key:
        try:
            delivery_status = await _send_email(
                recipient=recipient,
                subject=f"[SENTINEL MESH] High Risk Alert — Cluster {cluster_id} — Risk Score {cluster_data['risk_score']}",
                body=_format_email_body(cluster_data, sormas_payload, alerts),
                api_key=email_key,
            )
        except Exception as e:
            delivery_status = f"email_failed: {str(e)}"

    # Try SMS if credentials are available
    sms_to = os.getenv("NOTIFY_SMS_TO")
    at_key = os.getenv("AFRICASTALKING_API_KEY")
    if sms_to and at_key:
        try:
            sms_status = await _send_sms(
                phone=sms_to,
                message=alerts.get("en", f"High risk alert for cluster {cluster_id}"),
                api_key=at_key,
                username=os.getenv("AFRICASTALKING_USERNAME", "sandbox"),
            )
            notification_type = "both" if delivery_status == "sent" else "sms"
            if sms_status == "sent":
                delivery_status = "sent" if delivery_status == "sent" else "sms_sent"
        except Exception as e:
            pass  # SMS is best-effort

    # 5. Write audit log entry
    audit_entry = {
        "timestamp": datetime.utcnow(),
        "cluster_id": cluster_id,
        "risk_score": cluster_data["risk_score"],
        "trigger_reason": f"Manual trigger via API. Cluster {cluster_id} has {cluster_data['contributing_device_count']} contributing devices, {len(cluster_data.get('anomalous_devices', []))} anomalous.",
        "contributing_device_ids": cluster_data.get("anomalous_devices", []),
        "contributing_contact_events": cluster_data.get("contact_count", 0),
        "contributing_vitals_records": len(cluster_data.get("anomalous_devices", [])),
        "recipient": recipient,
        "payload_sent": {
            "sormas": sormas_payload,
            "alerts": alerts,
        },
        "delivery_status": delivery_status,
        "notification_type": notification_type,
    }

    await db.audit_log.insert_one(audit_entry)

    # Convert for JSON response (ObjectId isn't serializable)
    audit_entry.pop("_id", None)
    audit_entry["timestamp"] = audit_entry["timestamp"].isoformat()

    return {
        "status": "notification_sent",
        "delivery_status": delivery_status,
        "cluster_id": cluster_id,
        "risk_score": cluster_data["risk_score"],
        "alerts": alerts,
        "sormas_payload": sormas_payload,
        "audit_entry": audit_entry,
    }


def _format_email_body(cluster_data, sormas_payload, alerts):
    """Format a rich email body for the agency notification."""
    return f"""
=== SENTINEL MESH — AUTOMATED HEALTH ALERT ===

CLUSTER: {cluster_data['cluster_id']}
RISK SCORE: {cluster_data['risk_score']}/100
CONTRIBUTING DEVICES: {cluster_data['contributing_device_count']}
ANOMALOUS DEVICES: {', '.join(cluster_data.get('anomalous_devices', []))}

--- ALERT (English) ---
{alerts.get('en', 'N/A')}

--- ALERT (Yoruba) ---
{alerts.get('yo', 'N/A')}

--- ALERT (Hausa) ---
{alerts.get('ha', 'N/A')}

--- ALERT (Igbo) ---
{alerts.get('ig', 'N/A')}

--- ALERT (Pidgin) ---
{alerts.get('pcm', 'N/A')}

--- SORMAS/eIDSR PAYLOAD ---
{json.dumps(sormas_payload, indent=2, default=str)}

---
This is an automated notification from the Sentinel Mesh IoT Health Surveillance System.
For explainability details, visit the audit dashboard.
"""


async def _send_email(recipient: str, subject: str, body: str, api_key: str):
    """Attempt to send email via provider. Returns delivery status."""
    # Placeholder for real email integration (SendGrid/Resend)
    # In production, use httpx to call the provider's REST API
    import httpx
    # For now, log and return simulated
    print(f"[NOTIFICATION] Would send email to {recipient}: {subject[:50]}...")
    return "simulated"


async def _send_sms(phone: str, message: str, api_key: str, username: str):
    """Attempt to send SMS via Africa's Talking. Returns delivery status."""
    import httpx
    # Placeholder for Africa's Talking sandbox
    print(f"[NOTIFICATION] Would send SMS to {phone}: {message[:50]}...")
    return "simulated"
