"""
Composio bridge - service catalog and OAuth URL generation.
Provides a catalog of popular services that can be connected via Composio's MCP servers.
"""

from __future__ import annotations

import httpx
from app.config import COMPOSIO_API_KEY
from .models import MCPService

# Pre-configured service catalog
# These map to Composio's hosted MCP server endpoints
SERVICE_CATALOG: list[MCPService] = [
    MCPService(
        id="google_sheets",
        name="Google Sheets",
        description="スプレッドシートの読み書き、セル操作、シート管理",
        icon_url="/icons/google-sheets.svg",
        auth_type="oauth",
        categories=["productivity", "data"],
        available_tools=[
            "read_range", "write_range", "append_row",
            "create_spreadsheet", "list_sheets",
        ],
    ),
    MCPService(
        id="slack",
        name="Slack",
        description="メッセージ送信、チャンネル管理、ユーザー情報取得",
        icon_url="/icons/slack.svg",
        auth_type="oauth",
        categories=["communication"],
        available_tools=[
            "send_message", "list_channels", "get_channel_history",
            "create_channel", "upload_file",
        ],
    ),
    MCPService(
        id="notion",
        name="Notion",
        description="ページ作成・更新、データベース操作、検索",
        icon_url="/icons/notion.svg",
        auth_type="oauth",
        categories=["productivity", "knowledge"],
        available_tools=[
            "create_page", "update_page", "query_database",
            "search", "get_page",
        ],
    ),
    MCPService(
        id="google_calendar",
        name="Google Calendar",
        description="予定の作成・取得・更新、空き時間確認",
        icon_url="/icons/google-calendar.svg",
        auth_type="oauth",
        categories=["productivity", "scheduling"],
        available_tools=[
            "list_events", "create_event", "update_event",
            "delete_event", "get_freebusy",
        ],
    ),
    MCPService(
        id="stripe",
        name="Stripe",
        description="決済情報取得、顧客管理、請求書操作",
        icon_url="/icons/stripe.svg",
        auth_type="api_key",
        categories=["finance", "payment"],
        available_tools=[
            "list_customers", "list_charges", "create_invoice",
            "get_balance", "list_subscriptions",
        ],
    ),
    MCPService(
        id="gmail",
        name="Gmail",
        description="メール送信・検索・管理、ラベル操作",
        icon_url="/icons/gmail.svg",
        auth_type="oauth",
        categories=["communication", "email"],
        available_tools=[
            "send_email", "search_emails", "get_email",
            "list_labels", "create_draft",
        ],
    ),
]


def get_service_catalog() -> list[MCPService]:
    """Return the list of available services."""
    return SERVICE_CATALOG


def get_service_by_id(service_id: str) -> MCPService | None:
    """Find a service by its ID."""
    for svc in SERVICE_CATALOG:
        if svc.id == service_id:
            return svc
    return None


async def get_oauth_url(service_id: str, redirect_uri: str, company_id: str) -> str | None:
    """Generate OAuth authorization URL via Composio API.
    Returns the URL the user should be redirected to for OAuth consent."""
    if not COMPOSIO_API_KEY:
        return None

    service = get_service_by_id(service_id)
    if not service or service.auth_type != "oauth":
        return None

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://backend.composio.dev/api/v1/connectedAccounts",
                headers={
                    "X-API-Key": COMPOSIO_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "integrationId": service_id,
                    "redirectUri": redirect_uri,
                    "data": {"companyId": company_id},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("redirectUrl", data.get("url"))
    except Exception:
        return None


async def handle_oauth_callback(
    service_id: str, code: str, state: str | None = None
) -> dict | None:
    """Process OAuth callback from Composio.
    Returns connection credentials if successful."""
    if not COMPOSIO_API_KEY:
        return None

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://backend.composio.dev/api/v1/connectedAccounts",
                headers={"X-API-Key": COMPOSIO_API_KEY},
                params={"code": code},
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list) and data:
                account = data[0]
            elif isinstance(data, dict):
                account = data
            else:
                return None

            return {
                "access_token": account.get("accessToken", ""),
                "account_id": account.get("id", ""),
                "status": account.get("status", "active"),
            }
    except Exception:
        return None


def get_composio_mcp_url(service_id: str) -> str:
    """Get the MCP server URL for a Composio service."""
    return f"https://mcp.composio.dev/api/{service_id}"
