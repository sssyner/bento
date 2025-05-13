from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import require_auth
from app.services.firestore import get_db, get_user_company_id, get_company_collection

router = APIRouter()


@router.get("")
def get_dashboard(user: dict = Depends(require_auth)):
    """Dashboard summary: completion rate, delays, pending approvals."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    exec_col = get_company_collection(db, company_id, "workflow_executions")
    all_execs = list(exec_col.stream())

    total = len(all_execs)
    completed = 0
    in_progress = 0
    rejected = 0
    pending_approvals = 0

    for doc in all_execs:
        data = doc.to_dict()
        status = data.get("status", "")
        if status == "completed":
            completed += 1
        elif status == "in_progress":
            in_progress += 1
            # Check if current step is an approval step
            template_col = get_company_collection(db, company_id, "workflow_templates")
            tmpl_doc = template_col.document(data.get("templateId", "")).get()
            if tmpl_doc.exists:
                tmpl = tmpl_doc.to_dict()
                current_step_id = data.get("currentStepId", "")
                for step in tmpl.get("steps", []):
                    if step["id"] == current_step_id and step["type"] == "approval":
                        pending_approvals += 1
        elif status == "rejected":
            rejected += 1

    return {
        "total": total,
        "completed": completed,
        "inProgress": in_progress,
        "rejected": rejected,
        "pendingApprovals": pending_approvals,
        "completionRate": round((completed / total * 100) if total > 0 else 0, 1),
    }


@router.get("/by-user")
def get_dashboard_by_user(user: dict = Depends(require_auth)):
    """Per-user progress breakdown."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    exec_col = get_company_collection(db, company_id, "workflow_executions")
    all_execs = list(exec_col.stream())

    user_stats: dict[str, dict] = {}

    for doc in all_execs:
        data = doc.to_dict()
        assignee = data.get("assigneeId", "unknown")
        if assignee not in user_stats:
            user_stats[assignee] = {"total": 0, "completed": 0, "inProgress": 0}
        user_stats[assignee]["total"] += 1
        if data.get("status") == "completed":
            user_stats[assignee]["completed"] += 1
        elif data.get("status") == "in_progress":
            user_stats[assignee]["inProgress"] += 1

    # Resolve user names
    result = []
    for uid, stats in user_stats.items():
        user_doc = db.collection("users").document(uid).get()
        name = user_doc.to_dict().get("name", uid) if user_doc.exists else uid
        department = user_doc.to_dict().get("department", "") if user_doc.exists else ""
        result.append({
            "uid": uid,
            "name": name,
            "department": department,
            **stats,
            "completionRate": round((stats["completed"] / stats["total"] * 100) if stats["total"] > 0 else 0, 1),
        })

    return result
