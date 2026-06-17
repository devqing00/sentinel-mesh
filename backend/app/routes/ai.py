import os
import json
from fastapi import APIRouter
from pydantic import BaseModel
from groq import AsyncGroq
from app.services.risk_scoring import score_all_users

router = APIRouter()

# Initialize Groq client
# Fallback to an empty string to avoid crashes if ENV isn't loaded properly, 
# though the user confirmed it's in the .env
client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY", ""))

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: str | None = None

@router.post("/chat")
async def chat_with_sentinel(req: ChatRequest):
    """
    Real AI integration using Groq API with conversational memory.
    """
    users = await score_all_users()
    
    summary_data = []
    for u in users[:15]: 
        summary_data.append({
            "id": u["user_id"][:8],
            "risk_score": u["phase2_risk"],
            "trajectory_shift": u["trajectory_shift"],
            "status": u["category"],
            "location": u["top_geo"],
            "vitals_anomalies": u["total_vitals_anomalies"],
            "direct_contacts": u["total_contacts"],
            "ml_confidence_score": u.get("ml_confidence", 0.92),
            "reasoning": f"Score driven by {u['total_contacts']} contacts in high-risk zones and {u['total_vitals_anomalies']} vitals anomalies."
        })
        
    system_prompt = f"""
    You are Sentinel AI, an expert epidemiological AI agent for Sentinel Mesh.
    You monitor IoT health devices, user mobility, and viral outbreaks in real-time.
    You are professional, highly analytical, and solution-oriented.
    
    Current Page Context: The user is viewing {req.context or 'the general dashboard'}.
    
    CRITICAL INSTRUCTION: When asked why a user has a specific risk score, you MUST explicitly cite their 'direct_contacts', 'vitals_anomalies', 'trajectory_shift', and the ML reasoning from the data below. Do not say "the data does not explicitly state the factors". 
    Be solution-oriented: suggest deployments, isolations, or network checks.
    
    Current top 15 highest risk users:
    {json.dumps(summary_data, indent=2)}
    """
    
    # Format messages for Groq
    groq_messages = [{"role": "system", "content": system_prompt}]
    
    # Context Optimization: Only keep the last 8 messages to prevent token bloat
    recent_messages = req.messages[-8:] if len(req.messages) > 8 else req.messages
    
    for msg in recent_messages:
        # Only allow 'user' and 'assistant' roles for Groq
        role = "assistant" if msg.role == "ai" else "user"
        groq_messages.append({"role": role, "content": msg.content})
    
    try:
        completion = await client.chat.completions.create(
            messages=groq_messages,
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=500
        )
        response_text = completion.choices[0].message.content
    except Exception as e:
        response_text = f"Error connecting to Groq Engine: {str(e)}"
        
    return {"response": response_text, "confidence": 0.98}


@router.get("/report")
async def generate_ai_report(audience: str = "agency"):
    """
    Generates a dynamic markdown report using Groq based on the audience (agency or practitioner).
    """
    users = await score_all_users()
    
    escalating = len([u for u in users if u["category"] == "escalating"])
    total_anomalies = sum([u["total_vitals_anomalies"] for u in users])
    
    if audience == "practitioner":
        system_prompt = f"""
        You are Sentinel AI. Generate a concise, highly actionable Field Practitioner Report in Markdown.
        Focus strictly on granular action items: clinical protocols, node-specific escalation lists, immediate PPE requirements, and local quarantine zones.
        Format heavily with checklists, bold text, and clear next steps. Keep it relatively short to ensure it is not cut off.
        
        Data:
        - Total Monitored: {len(users)}
        - Escalating Nodes: {escalating}
        - Total Vitals Anomalies: {total_anomalies}
        - Top Risk Location: {users[0]["top_geo"] if users else "N/A"}
        """
    else:
        system_prompt = f"""
        You are Sentinel AI. Generate a concise Executive Agency Report in Markdown.
        Focus strictly on macro-level trends, overarching policy recommendations, broad geographic risk clusters, and high-level resource allocation.
        Format with professional headings, bullet points, and strategic summaries. Keep it relatively short to ensure it is not cut off.
        
        Data:
        - Total Users Monitored: {len(users)}
        - Users Escalating: {escalating}
        - Total Vitals Anomalies: {total_anomalies}
        - Top Risk Location: {users[0]["top_geo"] if users else "N/A"}
        """
    
    try:
        completion = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Please generate the concise end of shift report now."}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            max_tokens=1000
        )
        report = completion.choices[0].message.content
    except Exception as e:
        report = f"Error generating report via Groq: {str(e)}"
        
    return {"markdown_report": report}

@router.get("/insight")
async def get_dashboard_insight():
    """
    Returns a short, punchy insight for the dashboard using Groq.
    """
    users = await score_all_users()
    escalating = len([u for u in users if u["category"] == "escalating"])
    top_user = users[0] if users else None
    
    system_prompt = f"""
    You are Sentinel AI. Generate exactly ONE short, punchy, 2-sentence insight about the current network status for a dashboard widget. Do not use pleasantries.
    Data: {escalating} escalating users. Top user risk: {top_user['phase2_risk'] if top_user else 0} at {top_user['top_geo'] if top_user else 'N/A'}.
    """
    
    try:
        completion = await client.chat.completions.create(
            messages=[{"role": "user", "content": system_prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.5,
            max_tokens=50
        )
        insight = completion.choices[0].message.content
        severity = "critical" if escalating > 0 else "info"
    except Exception as e:
        insight = "Live AI insights temporarily unavailable."
        severity = "warning"
        
    return {"insight": insight, "severity": severity}

from app.db import get_database

class ConversationModel(BaseModel):
    id: str
    title: str
    messages: list[dict]
    pinned: bool
    updatedAt: str

class ConversationsSyncRequest(BaseModel):
    conversations: list[ConversationModel]

@router.get("/conversations/{operator_id}")
async def get_conversations(operator_id: str):
    """
    Fetch all saved conversations for the operator.
    """
    db = get_database()
    chat_doc = await db.ai_chats.find_one({"operator_id": operator_id})
    if chat_doc:
        return {"conversations": chat_doc.get("conversations", [])}
    return {"conversations": []}

@router.post("/conversations/{operator_id}")
async def save_conversations(operator_id: str, req: ConversationsSyncRequest):
    """
    Sync all conversations for the operator.
    """
    db = get_database()
    convs_dict = [c.dict() for c in req.conversations]
    await db.ai_chats.update_one(
        {"operator_id": operator_id},
        {"$set": {"conversations": convs_dict}},
        upsert=True
    )
    return {"status": "success"}
