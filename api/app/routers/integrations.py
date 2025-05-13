from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.middleware.auth import require_auth
from app.services.integrations import list_integrations, execute_webhook

router = APIRouter()


@router.get("")
def get_integrations(user: dict = Depends(require_auth)):
    """List all available integrations."""
    return list_integrations()


class WebhookTestRequest(BaseModel):
    url: str
    method: str = "POST"
    headers: dict | None = None
    body: dict | None = None


@router.post("/test-webhook")
async def test_webhook(body: WebhookTestRequest, user: dict = Depends(require_auth)):
    """Test a webhook connection."""
    result = await execute_webhook(
        url=body.url,
        method=body.method,
        headers=body.headers,
        body=body.body,
    )
    return {"success": result.success, "data": result.data, "error": result.error}
