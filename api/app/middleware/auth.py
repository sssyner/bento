from fastapi import Depends, HTTPException, Request
from firebase_admin import auth as firebase_auth


def get_current_user(request: Request) -> dict:
    """Extract and verify Firebase Auth token from Authorization header."""
    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.split("Bearer ")[1]
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_auth(user: dict = Depends(get_current_user)) -> dict:
    return user
