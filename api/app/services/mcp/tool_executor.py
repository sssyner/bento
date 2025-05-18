"""
MCPToolExecutor - Executes tools and logs results to Firestore.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.services.firestore import get_db, get_company_collection
from .manager import get_mcp_manager
from .models import MCPToolCallResult, MCPToolLog


class MCPToolExecutor:
    """Executes MCP tool calls with logging."""

    async def execute(
        self,
        company_id: str,
        connection_id: str,
        tool_name: str,
        arguments: dict,
        user_id: str,
        context: str = "manual",
    ) -> MCPToolCallResult:
        """Execute a tool call and log the result."""
        manager = get_mcp_manager()
        result = await manager.call_tool(
            company_id, connection_id, tool_name, arguments
        )

        # Log to Firestore
        await self._log_execution(
            company_id=company_id,
            connection_id=connection_id,
            tool_name=tool_name,
            arguments=arguments,
            result=result,
            user_id=user_id,
            context=context,
        )

        return result

    async def _log_execution(
        self,
        company_id: str,
        connection_id: str,
        tool_name: str,
        arguments: dict,
        result: MCPToolCallResult,
        user_id: str,
        context: str,
    ) -> None:
        """Log tool execution to Firestore."""
        db = get_db()
        col = get_company_collection(db, company_id, "mcp_tool_logs")

        log_id = f"log_{uuid.uuid4().hex[:12]}"
        log_entry = MCPToolLog(
            id=log_id,
            connection_id=connection_id,
            tool_name=tool_name,
            arguments=arguments,
            result=result.result if result.success else {"error": result.error},
            success=result.success,
            execution_time_ms=result.execution_time_ms,
            called_by=user_id,
            called_at=datetime.now(timezone.utc).isoformat(),
            context=context,
        )
        col.document(log_id).set(log_entry.model_dump())


# Singleton
_executor: MCPToolExecutor | None = None


def get_tool_executor() -> MCPToolExecutor:
    global _executor
    if _executor is None:
        _executor = MCPToolExecutor()
    return _executor
