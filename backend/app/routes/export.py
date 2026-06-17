from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from app.services.sormas_export import generate_sormas_payload
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/api/export", tags=["export"])

@router.get("/sormas/{cluster_id}")
async def export_sormas(cluster_id: str, user: dict = Depends(get_current_user)):
    return await generate_sormas_payload(cluster_id)

@router.get("/sormas/{cluster_id}/csv")
async def export_sormas_csv(cluster_id: str, user: dict = Depends(get_current_user)):
    data = await generate_sormas_payload(cluster_id)
    csv_str = f"reportDate,region,district,caseStatus\n{data['reportDate']},{data['region']},{data['district']},{data['caseStatus']}"
    return PlainTextResponse(csv_str)
