"""MCP Integration endpoints - connection management, tool discovery, tool execution."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.middleware.auth import require_auth
from app.services.firestore import get_db, get_user_company_id
from app.services.mcp.manager import get_mcp_manager
from app.services.mcp.models import MCPConnection, MCPToolCallRequest
from app.services.mcp.composio_bridge import (
    get_service_catalog,
    get_service_by_id,
    get_oauth_url,
    handle_oauth_callback,
    get_composio_mcp_url,
)
from app.services.mcp.tool_executor import get_tool_executor

router = APIRouter()


class CreateConnectionRequest(BaseModel):
    server_name: str
    server_url: str
    auth_type: str = "none"
    credentials: str = ""
    description: str = ""
    service_id: str = ""


class ToolCallRequest(BaseModel):
    connection_id: str
    tool_name: str
    arguments: dict = Field(default_factory=dict)


class OAuthCallbackRequest(BaseModel):
    code: str
    state: str | None = None


@router.get("/services")
async def list_services(user: dict = Depends(require_auth)):
    """Get Composio service catalog - available integrations."""
    catalog = get_service_catalog()
    return {"services": [s.model_dump() for s in catalog]}


@router.get("/connections")
async def list_connections(user: dict = Depends(require_auth)):
    """List all MCP connections for the user's company."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=400, detail="No company found")

    manager = get_mcp_manager()
    connections = await manager.list_connections(company_id)
    return {"connections": [c.model_dump() for c in connections]}


@router.post("/connections")
async def create_connection(
    body: CreateConnectionRequest,
    user: dict = Depends(require_auth),
):
    """Create a new MCP connection."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=400, detail="No company found")

    # If service_id is provided, use Composio MCP URL
    server_url = body.server_url
    if body.service_id and not server_url:
        server_url = get_composio_mcp_url(body.service_id)

    connection = MCPConnection(
        server_name=body.server_name,
        server_url=server_url,
        auth_type=body.auth_type,
        encrypted_credentials=body.credentials,
        description=body.description,
        service_id=body.service_id,
    )

    manager = get_mcp_manager()
    created = await manager.create_connection(company_id, connection, user["uid"])
    return created.model_dump()


@router.delete("/connections/{connection_id}")
async def delete_connection(
    connection_id: str,
    user: dict = Depends(require_auth),
):
    """Delete an MCP connection."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=400, detail="No company found")

    manager = get_mcp_manager()
    deleted = await manager.delete_connection(company_id, connection_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"success": True}


@router.post("/connections/{connection_id}/test")
async def test_connection(
    connection_id: str,
    user: dict = Depends(require_auth),
):
    """Test if an MCP connection is alive."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=400, detail="No company found")

    manager = get_mcp_manager()
    result = await manager.test_connection(company_id, connection_id)
    return result


@router.post("/connections/{connection_id}/refresh")
async def refresh_tools(
    connection_id: str,
    user: dict = Depends(require_auth),
):
    """Re-discover tools for a connection."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=400, detail="No company found")

    manager = get_mcp_manager()
    tools = await manager.refresh_tools(company_id, connection_id)
    return {"tools": [t.model_dump() for t in tools]}


@router.get("/tools")
async def list_all_tools(user: dict = Depends(require_auth)):
    """Get all tools from all enabled connections."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=400, detail="No company found")

    manager = get_mcp_manager()
    tools = await manager.list_all_tools(company_id)
    return {"tools": [t.model_dump() for t in tools]}


@router.post("/tools/call")
async def call_tool(
    body: ToolCallRequest,
    user: dict = Depends(require_auth),
):
    """Execute an MCP tool call."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=400, detail="No company found")

    executor = get_tool_executor()
    result = await executor.execute(
        company_id=company_id,
        connection_id=body.connection_id,
        tool_name=body.tool_name,
        arguments=body.arguments,
        user_id=user["uid"],
        context="manual",
    )
    return result.model_dump()


@router.get("/auth/{service_id}/url")
async def get_auth_url(
    service_id: str,
    redirect_uri: str = "",
    user: dict = Depends(require_auth),
):
    """Get OAuth authorization URL for a service."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=400, detail="No company found")

    service = get_service_by_id(service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    url = await get_oauth_url(service_id, redirect_uri, company_id)
    if not url:
        raise HTTPException(status_code=500, detail="Could not generate OAuth URL")

    return {"url": url, "service": service.model_dump()}


@router.post("/auth/{service_id}/callback")
async def oauth_callback(
    service_id: str,
    body: OAuthCallbackRequest,
    user: dict = Depends(require_auth),
):
    """Process OAuth callback and create connection."""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])
    if not company_id:
        raise HTTPException(status_code=400, detail="No company found")

    service = get_service_by_id(service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    creds = await handle_oauth_callback(service_id, body.code, body.state)
    if not creds:
        raise HTTPException(status_code=400, detail="OAuth callback failed")

    # Auto-create connection with obtained credentials
    connection = MCPConnection(
        server_name=service.name,
        server_url=get_composio_mcp_url(service_id),
        auth_type="oauth",
        encrypted_credentials=creds.get("access_token", ""),
        description=service.description,
        service_id=service_id,
    )

    manager = get_mcp_manager()
    created = await manager.create_connection(company_id, connection, user["uid"])
    return created.model_dump()
