import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth, credentials

# Initialize Firebase Admin if not already initialized
if not firebase_admin._apps:
    # Use explicit credentials if path is provided, otherwise relies on GOOGLE_APPLICATION_CREDENTIALS
    # or falls back to a mock for development if nothing is provided
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    try:
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
    except Exception as e:
        print(f"[AUTH WARNING] Could not fully initialize Firebase Admin. Using fallback/mock mode. Error: {e}")

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dependency to extract and verify the Firebase ID token.
    """
    token = credentials.credentials
    
    # DEV MOCK: If we are in local dev and no Firebase is configured, accept "mock-token"
    if os.getenv("FIREBASE_MOCK_AUTH", "true").lower() == "true" and token == "mock-token":
        return {"uid": "mock-user-123", "email": "operator@ncdc.gov.ng"}
        
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
