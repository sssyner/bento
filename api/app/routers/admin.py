from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from firebase_admin import auth as firebase_auth
from app.middleware.auth import require_auth
from app.models.user import UserInvite, UserResponse
from app.services.firestore import get_db, get_user_company_id

router = APIRouter()


def require_admin(user: dict = Depends(require_auth)) -> dict:
    db = get_db()
    uid = user["uid"]
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()
    if not user_doc.exists:
        raise HTTPException(status_code=403, detail="User not found")
    user_data = user_doc.to_dict()
    if user_data.get("role") not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager role required")
    return user


@router.get("/users")
def list_users(user: dict = Depends(require_admin)):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    users = db.collection("users").where("companyId", "==", company_id).stream()
    return [UserResponse(**u.to_dict()) for u in users]


@router.post("/users/invite")
def invite_user(body: UserInvite, user: dict = Depends(require_admin)):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    # Check if email already exists
    existing = db.collection("users").where("email", "==", body.email).limit(1).stream()
    if any(True for _ in existing):
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Create Firebase Auth user (they can reset password later)
    try:
        fb_user = firebase_auth.create_user(
            email=body.email,
            display_name=body.name,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create auth user: {str(e)}")

    now = datetime.now(timezone.utc).isoformat()
    user_data = {
        "uid": fb_user.uid,
        "companyId": company_id,
        "name": body.name,
        "email": body.email,
        "role": body.role,
        "department": body.department,
        "createdAt": now,
    }

    db.collection("users").document(fb_user.uid).set(user_data)

    return UserResponse(**user_data)
