from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
import uuid
from app.middleware.auth import require_auth
from app.models.workflow import WorkflowCreate, WorkflowUpdate, WorkflowResponse
from app.services.firestore import get_db, get_user_company_id, get_company_collection

router = APIRouter()


@router.get("")
def list_workflows(user: dict = Depends(require_auth)):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, "workflow_templates")
    docs = col.order_by("createdAt").stream()
    return [WorkflowResponse(**doc.to_dict()) for doc in docs]


@router.post("")
def create_workflow(body: WorkflowCreate, user: dict = Depends(require_auth)):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    now = datetime.now(timezone.utc).isoformat()
    wf_id = f"wf_{uuid.uuid4().hex[:12]}"

    data = {
        **body.model_dump(),
        "id": wf_id,
        "companyId": company_id,
        "createdBy": user["uid"],
        "createdAt": now,
        "updatedAt": now,
    }

    col = get_company_collection(db, company_id, "workflow_templates")
    col.document(wf_id).set(data)
    return WorkflowResponse(**data)


@router.get("/{workflow_id}")
def get_workflow(workflow_id: str, user: dict = Depends(require_auth)):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, "workflow_templates")
    doc = col.document(workflow_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return WorkflowResponse(**doc.to_dict())


@router.put("/{workflow_id}")
def update_workflow(workflow_id: str, body: WorkflowUpdate, user: dict = Depends(require_auth)):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, "workflow_templates")
    doc_ref = col.document(workflow_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Workflow not found")

    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    # Convert nested Pydantic models to dicts
    if "schedule" in update_data and hasattr(update_data["schedule"], "model_dump"):
        update_data["schedule"] = update_data["schedule"].model_dump()
    if "steps" in update_data:
        update_data["steps"] = [
            s.model_dump() if hasattr(s, "model_dump") else s for s in update_data["steps"]
        ]

    doc_ref.update(update_data)
    return WorkflowResponse(**doc_ref.get().to_dict())


@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: str, user: dict = Depends(require_auth)):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, "workflow_templates")
    doc_ref = col.document(workflow_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Workflow not found")

    doc_ref.delete()
    return {"status": "deleted"}
