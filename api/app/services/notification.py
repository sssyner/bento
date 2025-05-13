"""Notification service for FCM push notifications."""

from __future__ import annotations
from firebase_admin import messaging


def send_push_notification(token: str, title: str, body: str, data: dict | None = None):
    """Send a push notification via FCM."""
    message = messaging.Message(
        notification=messaging.Notification(title=title, body=body),
        data=data or {},
        token=token,
    )
    try:
        messaging.send(message)
    except Exception as e:
        print(f"FCM send error: {e}")


def send_workflow_started_notification(token: str, workflow_name: str):
    send_push_notification(
        token=token,
        title="締め作業の準備ができました",
        body=f"「{workflow_name}」を開始してください。",
        data={"type": "workflow_started"},
    )


def send_approval_request_notification(token: str, workflow_name: str, step_label: str):
    send_push_notification(
        token=token,
        title="承認依頼",
        body=f"「{workflow_name}」の「{step_label}」で承認が必要です。",
        data={"type": "approval_request"},
    )
