from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
import uuid
from app.middleware.auth import require_auth
from app.models.execution import ExecutionResponse, StepCompleteRequest, StepRejectRequest
from app.services.firestore import get_db, get_user_company_id, get_company_collection

router = APIRouter()


def create_execution_from_template(
    db, company_id: str, template_id: str, assignee_id: str,
    source_execution_id: str | None = None,
    source_workflow_name: str | None = None,
    source_assignee_name: str | None = None,
    source_data: dict | None = None,
) -> dict:
    """Create a new workflow execution from a template.

    Returns the raw execution dict (with 'template' attached).
    Reusable from both the API endpoint, the scheduler, and trigger_workflow chains.
    """
    template_col = get_company_collection(db, company_id, "workflow_templates")
    template_doc = template_col.document(template_id).get()
    if not template_doc.exists:
        return None

    template = template_doc.to_dict()
    steps = template.get("steps", [])
    if not steps:
        return None

    steps_sorted = sorted(steps, key=lambda s: s["order"])
    first_step_id = steps_sorted[0]["id"]

    now = datetime.now(timezone.utc).isoformat()
    exec_id = f"exec_{uuid.uuid4().hex[:12]}"

    step_results = {}
    for step in steps_sorted:
        step_results[step["id"]] = {
            "status": "in_progress" if step["id"] == first_step_id else "pending",
            "result": None,
            "completedAt": None,
            "completedBy": None,
        }

    exec_data = {
        "id": exec_id,
        "templateId": template_id,
        "companyId": company_id,
        "assigneeId": assignee_id,
        "status": "in_progress",
        "currentStepId": first_step_id,
        "startedAt": now,
        "completedAt": None,
        "steps": step_results,
    }

    # Attach chain info if triggered from another workflow
    if source_execution_id:
        exec_data["sourceExecutionId"] = source_execution_id
    if source_workflow_name:
        exec_data["sourceWorkflowName"] = source_workflow_name
    if source_assignee_name:
        exec_data["sourceAssigneeName"] = source_assignee_name
    if source_data:
        exec_data["sourceData"] = source_data

    exec_col = get_company_collection(db, company_id, "workflow_executions")
    exec_col.document(exec_id).set(exec_data)

    exec_data["template"] = template
    return exec_data


@router.get("/today")
def get_today_executions(user: dict = Depends(require_auth)):
    db = get_db()
    uid = user["uid"]
    company_id = get_user_company_id(db, uid)
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, "workflow_executions")

    # Get executions assigned to user, started today or still in progress
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    docs = col.where("assigneeId", "==", uid).stream()

    results = []
    for doc in docs:
        data = doc.to_dict()
        # Include if started today or still in progress
        if data.get("status") in ("pending", "in_progress") or (data.get("startedAt", "") >= today_start):
            # Attach template info
            template_col = get_company_collection(db, company_id, "workflow_templates")
            template_doc = template_col.document(data["templateId"]).get()
            if template_doc.exists:
                data["template"] = template_doc.to_dict()
            results.append(ExecutionResponse(**data))

    return results


@router.post("/start/{template_id}")
def start_execution(template_id: str, user: dict = Depends(require_auth)):
    """Start a new workflow execution from a template."""
    db = get_db()
    uid = user["uid"]
    company_id = get_user_company_id(db, uid)
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    exec_data = create_execution_from_template(db, company_id, template_id, uid)
    if exec_data is None:
        raise HTTPException(status_code=404, detail="Template not found or has no steps")

    return ExecutionResponse(**exec_data)


@router.get("/{execution_id}")
def get_execution(execution_id: str, user: dict = Depends(require_auth)):
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, "workflow_executions")
    doc = col.document(execution_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Execution not found")

    data = doc.to_dict()
    # Attach template
    template_col = get_company_collection(db, company_id, "workflow_templates")
    template_doc = template_col.document(data["templateId"]).get()
    if template_doc.exists:
        data["template"] = template_doc.to_dict()

    return ExecutionResponse(**data)


@router.post("/{execution_id}/steps/{step_id}/complete")
def complete_step(
    execution_id: str,
    step_id: str,
    body: StepCompleteRequest = StepCompleteRequest(),
    user: dict = Depends(require_auth),
):
    db = get_db()
    uid = user["uid"]
    company_id = get_user_company_id(db, uid)
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, "workflow_executions")
    doc_ref = col.document(execution_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Execution not found")

    data = doc.to_dict()
    if data["currentStepId"] != step_id:
        raise HTTPException(status_code=400, detail="Not the current step")

    now = datetime.now(timezone.utc).isoformat()

    # Complete current step
    data["steps"][step_id] = {
        "status": "completed",
        "result": body.result,
        "completedAt": now,
        "completedBy": uid,
    }

    # Find next step
    template_col = get_company_collection(db, company_id, "workflow_templates")
    template_doc = template_col.document(data["templateId"]).get()
    if not template_doc.exists:
        raise HTTPException(status_code=404, detail="Template not found")

    template = template_doc.to_dict()
    steps_sorted = sorted(template.get("steps", []), key=lambda s: s["order"])
    current_idx = next(
        (i for i, s in enumerate(steps_sorted) if s["id"] == step_id), -1
    )

    # Handle trigger_workflow step: chain into another workflow
    current_step_def = steps_sorted[current_idx]
    if current_step_def.get("type") == "trigger_workflow":
        config = current_step_def.get("config", {})
        target_wf_id = config.get("targetWorkflowId")
        if target_wf_id:
            # Collect data from all completed steps to pass along
            passed_data = None
            if config.get("passData", True):
                passed_data = {}
                for sid, sr in data["steps"].items():
                    if sr.get("result"):
                        passed_data[sid] = sr["result"]

            # Look up source user name
            source_name = None
            try:
                user_doc = db.collection("users").document(uid).get()
                if user_doc.exists:
                    source_name = user_doc.to_dict().get("name", uid)
            except Exception:
                source_name = uid

            # Determine assignee for target workflow
            target_template_doc = template_col.document(target_wf_id).get()
            target_assignee = uid  # fallback
            if target_template_doc.exists:
                target_tmpl = target_template_doc.to_dict()
                # Use the first assignee, or the creator of the target workflow
                target_assignees = target_tmpl.get("assigneeIds", [])
                if target_assignees:
                    target_assignee = target_assignees[0]
                elif target_tmpl.get("createdBy"):
                    target_assignee = target_tmpl["createdBy"]

            create_execution_from_template(
                db, company_id, target_wf_id, target_assignee,
                source_execution_id=execution_id,
                source_workflow_name=template.get("name", ""),
                source_assignee_name=source_name,
                source_data=passed_data,
            )

    if current_idx + 1 < len(steps_sorted):
        next_step = steps_sorted[current_idx + 1]
        data["currentStepId"] = next_step["id"]
        data["steps"][next_step["id"]]["status"] = "in_progress"
    else:
        data["status"] = "completed"
        data["completedAt"] = now

    doc_ref.set(data)

    data["template"] = template
    return ExecutionResponse(**data)


@router.post("/{execution_id}/steps/{step_id}/reject")
def reject_step(
    execution_id: str,
    step_id: str,
    body: StepRejectRequest = StepRejectRequest(),
    user: dict = Depends(require_auth),
):
    db = get_db()
    uid = user["uid"]
    company_id = get_user_company_id(db, uid)
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, "workflow_executions")
    doc_ref = col.document(execution_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Execution not found")

    data = doc.to_dict()
    now = datetime.now(timezone.utc).isoformat()

    # Reject = go back to previous step
    template_col = get_company_collection(db, company_id, "workflow_templates")
    template_doc = template_col.document(data["templateId"]).get()
    template = template_doc.to_dict()
    steps_sorted = sorted(template.get("steps", []), key=lambda s: s["order"])
    current_idx = next(
        (i for i, s in enumerate(steps_sorted) if s["id"] == step_id), -1
    )

    data["steps"][step_id] = {
        "status": "rejected",
        "result": None,
        "completedAt": None,
        "completedBy": None,
        "rejectedReason": body.reason,
    }

    if current_idx > 0:
        prev_step = steps_sorted[current_idx - 1]
        data["currentStepId"] = prev_step["id"]
        data["steps"][prev_step["id"]]["status"] = "in_progress"
        data["steps"][prev_step["id"]]["completedAt"] = None
        data["steps"][prev_step["id"]]["completedBy"] = None
    else:
        data["status"] = "rejected"

    doc_ref.set(data)

    data["template"] = template
    return ExecutionResponse(**data)


@router.post("/{execution_id}/steps/{step_id}/approve")
def approve_step(
    execution_id: str,
    step_id: str,
    user: dict = Depends(require_auth),
):
    """Approve an approval step (same as complete but semantically distinct)."""
    return complete_step(execution_id, step_id, StepCompleteRequest(result={"approved": True}), user)
