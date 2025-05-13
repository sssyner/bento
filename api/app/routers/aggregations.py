from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.middleware.auth import require_auth
from app.services.firestore import get_db, get_user_company_id, get_company_collection

router = APIRouter()


@router.get("/{job_id}/result")
def get_aggregation_result(job_id: str, user: dict = Depends(require_auth)):
    """Get the latest result of an aggregation job."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    col = get_company_collection(db, company_id, "aggregation_jobs")
    doc = col.document(job_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Aggregation job not found")
    return doc.to_dict()


class RunAggregationRequest(BaseModel):
    spreadsheet_id: str
    sheet_name: str
    target_column: str
    aggregation: str = "sum"


@router.post("/{job_id}/run")
def run_aggregation(job_id: str, body: RunAggregationRequest, user: dict = Depends(require_auth)):
    """Manually trigger an aggregation job."""
    from app.services.sheets import aggregate_column

    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company")

    try:
        result = aggregate_column(
            spreadsheet_id=body.spreadsheet_id,
            sheet_name=body.sheet_name,
            target_column=body.target_column,
            aggregation=body.aggregation,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Aggregation failed: {str(e)}")

    now = datetime.now(timezone.utc).isoformat()
    col = get_company_collection(db, company_id, "aggregation_jobs")
    col.document(job_id).set({
        "id": job_id,
        "lastRunAt": now,
        "lastResult": {"status": "success", **result},
    }, merge=True)

    return {"status": "success", **result}
