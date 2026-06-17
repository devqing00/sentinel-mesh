import os
import json
import httpx
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from pydantic import BaseModel
from groq import AsyncGroq
from app.services.contact_graph import generate_contact_graph
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/api/network", tags=["network"])

api_key = os.getenv("GROQ_API_KEY", "").strip()
client = AsyncGroq(
    api_key=api_key or "invalid_key", 
    timeout=httpx.Timeout(30.0)
)

class NetworkQueryRequest(BaseModel):
    question: str
    context: Optional[dict] = None

@router.get("/graph")
async def get_graph(
    end_date: Optional[str] = Query(None, description="Max date for timeline filtering"),
    user: dict = Depends(get_current_user)
):
    return await generate_contact_graph(end_date=end_date)

@router.post("/query")
async def query_network(req: NetworkQueryRequest):
    if not api_key:
        return {
            "answer": "Groq API Key is missing. Unable to analyze the network.",
            "highlight_nodes": [],
            "highlight_edges": [],
            "focus_note": "Please configure GROQ_API_KEY."
        }
    
    ctx = req.context or {}
    total_nodes = ctx.get("total_nodes", 0)
    total_edges = ctx.get("total_edges", 0)
    anomalous_nodes = ctx.get("anomalous_nodes", [])
    top_connected_ids = ctx.get("top_connected_ids", [])
    
    system_prompt = f"""
    You are Sentinel AI, an advanced epidemiological defense system analyzing a mesh contact network.
    The user asked: {req.question}
    
    Network context:
    - Total Nodes (Users/Devices): {total_nodes}
    - Total Edges (Contacts): {total_edges}
    - High Risk (Anomalous) Nodes: {anomalous_nodes}
    - Most Connected Nodes (Superspreaders): {top_connected_ids}
    
    Your goal is to answer the question with a highly analytical, precise, and tactical tone. 
    Analyze the provided network context to infer risks, clusters, or patterns. 
    Specify which nodes or edges to highlight in the UI graph to visually support your answer.
    - If asked about superspreaders, highest risk transmission chains, or risk zones, highlight the Most Connected Nodes if no High Risk Nodes exist.
    - If asked about anomalies, highlight the High Risk Nodes. Always strive to highlight relevant nodes in highlight_nodes so the UI updates dynamically.
    
    Respond STRICTLY with a valid JSON object matching this schema:
    {{
      "answer": "A concise, highly analytical, and authoritative explanation of the network state.",
      "highlight_nodes": ["user_id1", "user_id2"],
      "highlight_edges": [{{"source": "user_id1", "target": "user_id2"}}],
      "focus_note": "A small italicized tactical insight or recommendation."
    }}
    Do not include markdown blocks like ```json.
    """
    
    try:
        completion = await client.chat.completions.create(
            messages=[{"role": "system", "content": system_prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            max_tokens=800,
            response_format={"type": "json_object"}
        )
        result = json.loads(completion.choices[0].message.content)
        return result
    except Exception as e:
        return {
            "answer": f"Failed to analyze network: {str(e)}",
            "highlight_nodes": [],
            "highlight_edges": [],
            "focus_note": "API Error"
        }
