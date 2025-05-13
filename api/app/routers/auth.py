from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from app.middleware.auth import require_auth
from app.models.user import UserCreate, UserResponse
from app.services.firestore import get_db

router = APIRouter()


@router.post("/register")
def register(body: UserCreate, user: dict = Depends(require_auth)):
    db = get_db()
    uid = user["uid"]

    # Check if user already exists
    user_ref = db.collection("users").document(uid)
    if user_ref.get().exists:
        return {"status": "already_registered"}

    # Create or get default company for this user
    company_id = f"company_{uid[:8]}"
    company_ref = db.collection("companies").document(company_id)
    if not company_ref.get().exists:
        company_ref.set({
            "id": company_id,
            "name": f"{body.name}の会社",
            "plan": "free",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })

    # Create user document
    user_data = {
        "uid": uid,
        "companyId": company_id,
        "name": body.name,
        "email": body.email,
        "role": "admin",  # First user is admin
        "department": "",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    user_ref.set(user_data)

    return {"status": "registered", "companyId": company_id}


@router.get("/me", response_model=UserResponse)
def get_me(user: dict = Depends(require_auth)):
    db = get_db()
    uid = user["uid"]
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()
    if not user_doc.exists:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found. Please register first.")
    return UserResponse(**user_doc.to_dict())
