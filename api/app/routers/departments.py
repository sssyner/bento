from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from app.middleware.auth import require_auth
from app.models.department import DepartmentCreate, DepartmentUpdate, DepartmentResponse
from app.services.firestore import get_db, get_user_company_id

router = APIRouter()


@router.get("")
def list_departments(user: dict = Depends(require_auth)):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    docs = (
        db.collection("companies")
        .document(company_id)
        .collection("departments")
        .stream()
    )
    return [DepartmentResponse(id=d.id, companyId=company_id, **d.to_dict()) for d in docs]


@router.post("")
def create_department(body: DepartmentCreate, user: dict = Depends(require_auth)):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    now = datetime.now(timezone.utc).isoformat()
    data = {
        "name": body.name,
        "parentId": body.parentId,
        "managerUids": [user["uid"]],
        "memberUids": [user["uid"]],
        "createdAt": now,
    }

    ref = (
        db.collection("companies")
        .document(company_id)
        .collection("departments")
        .document()
    )
    ref.set(data)

    return DepartmentResponse(id=ref.id, companyId=company_id, **data)


@router.put("/{department_id}")
def update_department(
    department_id: str,
    body: DepartmentUpdate,
    user: dict = Depends(require_auth),
):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    ref = (
        db.collection("companies")
        .document(company_id)
        .collection("departments")
        .document(department_id)
    )
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Department not found")

    updates = body.model_dump(exclude_none=True)
    if updates:
        ref.update(updates)

    updated = ref.get().to_dict()
    return DepartmentResponse(id=department_id, companyId=company_id, **updated)


@router.post("/{department_id}/members/{uid}")
def add_member(
    department_id: str,
    uid: str,
    user: dict = Depends(require_auth),
):
    """Add a user to a department."""
    from google.cloud.firestore_v1 import ArrayUnion

    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    ref = (
        db.collection("companies")
        .document(company_id)
        .collection("departments")
        .document(department_id)
    )
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Department not found")

    ref.update({"memberUids": ArrayUnion([uid])})

    # Also update user's departmentId
    db.collection("users").document(uid).update({"departmentId": department_id})

    return {"status": "ok"}


@router.delete("/{department_id}/members/{uid}")
def remove_member(
    department_id: str,
    uid: str,
    user: dict = Depends(require_auth),
):
    """Remove a user from a department."""
    from google.cloud.firestore_v1 import ArrayRemove

    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    ref = (
        db.collection("companies")
        .document(company_id)
        .collection("departments")
        .document(department_id)
    )
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Department not found")

    ref.update({"memberUids": ArrayRemove([uid])})
    db.collection("users").document(uid).update({"departmentId": None})

    return {"status": "ok"}


@router.delete("/{department_id}")
def delete_department(
    department_id: str,
    user: dict = Depends(require_auth),
):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    ref = (
        db.collection("companies")
        .document(company_id)
        .collection("departments")
        .document(department_id)
    )
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Department not found")

    ref.delete()
    return {"status": "ok"}
