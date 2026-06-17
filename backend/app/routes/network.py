from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.services.contact_graph import generate_contact_graph
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/api/network", tags=["network"])

@router.get("/graph")
async def get_graph(
    end_date: Optional[str] = Query(None, description="Max date for timeline filtering"),
    user: dict = Depends(get_current_user)
):
    return await generate_contact_graph(end_date=end_date)
