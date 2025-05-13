from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
import uuid
from app.middleware.auth import require_auth
from app.models.screen import (
    UserAppCreate, UserAppUpdate, UserAppResponse,
    DataRecordCreate, DataRecordResponse,
)
from app.services.firestore import get_db, get_user_company_id, get_company_collection

router = APIRouter()


@router.get("")
def list_apps(user: dict = Depends(require_auth)):
    db = get_db()
    uid = user["uid"]
    company_id = get_user_company_id(db, uid)
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, "user_apps")
    docs = col.where("userId", "==", uid).stream()
    return [UserAppResponse(**doc.to_dict()) for doc in docs]


@router.post("")
def create_app(body: UserAppCreate, user: dict = Depends(require_auth)):
    db = get_db()
    uid = user["uid"]
    company_id = get_user_company_id(db, uid)
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    now = datetime.now(timezone.utc).isoformat()
    app_id = f"app_{uuid.uuid4().hex[:12]}"

    data = {
        **body.model_dump(),
        "id": app_id,
        "userId": uid,
        "companyId": company_id,
        "createdBy": uid,
        "createdAt": now,
        "updatedAt": now,
    }

    col = get_company_collection(db, company_id, "user_apps")
    col.document(app_id).set(data)
    return UserAppResponse(**data)


@router.get("/{app_id}")
def get_app(app_id: str, user: dict = Depends(require_auth)):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, "user_apps")
    doc = col.document(app_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="App not found")
    return UserAppResponse(**doc.to_dict())


@router.put("/{app_id}")
def update_app(app_id: str, body: UserAppUpdate, user: dict = Depends(require_auth)):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, "user_apps")
    doc_ref = col.document(app_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="App not found")

    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    # Serialize nested models
    if "screens" in update_data:
        update_data["screens"] = [
            s.model_dump() if hasattr(s, "model_dump") else s
            for s in update_data["screens"]
        ]

    doc_ref.update(update_data)
    return UserAppResponse(**doc_ref.get().to_dict())


@router.delete("/{app_id}")
def delete_app(app_id: str, user: dict = Depends(require_auth)):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, "user_apps")
    doc_ref = col.document(app_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="App not found")

    doc_ref.delete()
    return {"status": "deleted"}


@router.get("/{app_id}/data/{source}")
def list_data(app_id: str, source: str, user: dict = Depends(require_auth)):
    """List records from a user-defined data source (e.g., 'customers')."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, f"app_data_{app_id}_{source}")
    docs = col.order_by("createdAt", direction="DESCENDING").limit(100).stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.post("/{app_id}/data/{source}")
def create_data(
    app_id: str, source: str,
    body: DataRecordCreate,
    user: dict = Depends(require_auth),
):
    """Add a record to a user-defined data source."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, f"app_data_{app_id}_{source}")
    record_id = f"rec_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    record = {
        "id": record_id,
        **body.data,
        "createdAt": now,
        "createdBy": user["uid"],
    }
    col.document(record_id).set(record)
    return record


@router.put("/{app_id}/data/{source}/{record_id}")
def update_data(
    app_id: str, source: str, record_id: str,
    body: DataRecordCreate,
    user: dict = Depends(require_auth),
):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, f"app_data_{app_id}_{source}")
    doc_ref = col.document(record_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Record not found")

    now = datetime.now(timezone.utc).isoformat()
    doc_ref.update({**body.data, "updatedAt": now, "updatedBy": user["uid"]})
    return {"id": record_id, **doc_ref.get().to_dict()}


@router.delete("/{app_id}/data/{source}/{record_id}")
def delete_data(
    app_id: str, source: str, record_id: str,
    user: dict = Depends(require_auth),
):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, f"app_data_{app_id}_{source}")
    doc_ref = col.document(record_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Record not found")

    doc_ref.delete()
    return {"status": "deleted"}
