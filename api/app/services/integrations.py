"""
External service integrations.
Provides a unified interface for connecting with common business tools.
Each integration can be used as a webhook step or dedicated integration step.
"""

from __future__ import annotations
import httpx
from dataclasses import dataclass


@dataclass
class IntegrationResult:
    success: bool
    data: dict | None = None
    error: str | None = None


AVAILABLE_INTEGRATIONS = {
    "slack": {
        "name": "Slack",
        "description": "チームチャットに通知を送信",
        "auth_type": "webhook_url",  # or "oauth"
        "actions": ["send_message", "send_file"],
    },
    "line_works": {
        "name": "LINE WORKS",
        "description": "LINE WORKSに通知を送信",
        "auth_type": "api_key",
        "actions": ["send_message"],
    },
    "chatwork": {
        "name": "Chatwork",
        "description": "Chatworkに通知を送信",
        "auth_type": "api_key",
        "actions": ["send_message", "create_task"],
    },
    "freee": {
        "name": "freee会計",
        "description": "会計データの取得・仕訳作成",
        "auth_type": "oauth",
        "actions": ["get_deals", "create_deal", "get_invoices"],
    },
    "money_forward": {
        "name": "マネーフォワード",
        "description": "経費精算・会計連携",
        "auth_type": "oauth",
        "actions": ["get_expenses", "create_expense"],
    },
    "salesforce": {
        "name": "Salesforce",
        "description": "顧客管理・商談データ",
        "auth_type": "oauth",
        "actions": ["get_opportunities", "update_record", "create_record"],
    },
    "hubspot": {
        "name": "HubSpot",
        "description": "CRM・マーケティング",
        "auth_type": "api_key",
        "actions": ["get_contacts", "create_contact", "get_deals"],
    },
    "notion": {
        "name": "Notion",
        "description": "ドキュメント・データベース",
        "auth_type": "api_key",
        "actions": ["query_database", "create_page", "update_page"],
    },
    "gmail": {
        "name": "Gmail",
        "description": "メール送信・取得",
        "auth_type": "oauth",
        "actions": ["send_email", "get_emails"],
    },
    "custom_webhook": {
        "name": "カスタムWebhook",
        "description": "任意のAPIエンドポイント",
        "auth_type": "custom",
        "actions": ["call"],
    },
}


async def execute_webhook(
    url: str,
    method: str = "POST",
    headers: dict | None = None,
    body: dict | None = None,
    timeout: int = 30,
) -> IntegrationResult:
    """Execute a generic webhook call."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.request(
                method=method,
                url=url,
                headers=headers or {},
                json=body,
            )
            return IntegrationResult(
                success=resp.status_code < 400,
                data={"status_code": resp.status_code, "body": resp.text},
            )
    except Exception as e:
        return IntegrationResult(success=False, error=str(e))


async def send_slack_message(webhook_url: str, text: str, blocks: list | None = None) -> IntegrationResult:
    """Send a message to Slack via incoming webhook."""
    body: dict = {"text": text}
    if blocks:
        body["blocks"] = blocks
    return await execute_webhook(webhook_url, body=body)


async def send_chatwork_message(api_key: str, room_id: str, message: str) -> IntegrationResult:
    """Send a message to Chatwork."""
    return await execute_webhook(
        url=f"https://api.chatwork.com/v2/rooms/{room_id}/messages",
        headers={"X-ChatWorkToken": api_key},
        body={"body": message},
    )


def list_integrations() -> list[dict]:
    """Return all available integrations."""
    return [
        {"id": k, **v}
        for k, v in AVAILABLE_INTEGRATIONS.items()
    ]
