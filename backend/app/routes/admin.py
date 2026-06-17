from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from firebase_admin import auth
from app.dependencies.auth import get_current_user
import os

router = APIRouter(prefix="/api/admin", tags=["admin"])

class ClaimRequest(BaseModel):
    uid: str
    role: str
    zone: str = None

@router.post("/set-claims")
async def set_custom_claims(req: ClaimRequest, user: dict = Depends(get_current_user)):
    """
    Set custom claims (role and zone) for a Firebase user.
    Only accessible by super_admin.
    """
    # Enforce Super Admin
    if user.get("role") != "super_admin" and os.getenv("FIREBASE_MOCK_AUTH", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="Super Admin privileges required")
        
    valid_roles = ["super_admin", "lga", "chew", "community"]
    if req.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of {valid_roles}")
        
    claims = {"role": req.role}
    if req.zone:
        claims["zone"] = req.zone
        
    try:
        auth.set_custom_user_claims(req.uid, claims)
        return {"status": "success", "message": f"Claims {claims} set for user {req.uid}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bootstrap-super-admin")
async def bootstrap_super_admin(email: str):
    """
    Hackathon helper: Promotes a specific email to super_admin.
    In production, this would be protected by a strict IP allowlist or disabled.
    """
    try:
        user_record = auth.get_user_by_email(email)
        claims = {"role": "super_admin", "zone": "ALL"}
        auth.set_custom_user_claims(user_record.uid, claims)
        return {"status": "success", "message": f"Promoted {email} to Super Admin"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not promote user: {e}")
