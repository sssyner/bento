"""
MCPManager - Connection management, session pooling, and tool discovery.
Uses the official MCP SDK to connect to MCP servers.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from datetime import datetime, timezone

from cryptography.fernet import Fernet

from app.config import MCP_ENCRYPTION_KEY, MCP_CONNECTION_TIMEOUT
from app.services.firestore import get_db, get_company_collection
from .models import MCPConnection, MCPToolInfo, MCPToolCallResult


class MCPManager:
    """Manages MCP server connections and tool discovery."""

    def __init__(self):
        self._sessions: dict[str, object] = {}  # connection_id -> MCP session
        self._fernet: Fernet | None = None
        if MCP_ENCRYPTION_KEY:
            self._fernet = Fernet(MCP_ENCRYPTION_KEY.encode())

    def _encrypt(self, plaintext: str) -> str:
        if not self._fernet or not plaintext:
            return plaintext
        return self._fernet.encrypt(plaintext.encode()).decode()

    def _decrypt(self, ciphertext: str) -> str:
        if not self._fernet or not ciphertext:
            return ciphertext
        try:
            return self._fernet.decrypt(ciphertext.encode()).decode()
        except Exception:
            return ciphertext

    # ---- Connection CRUD ----

    async def create_connection(
        self,
        company_id: str,
        connection: MCPConnection,
        user_id: str,
    ) -> MCPConnection:
        """Create a new MCP connection and discover tools."""
        db = get_db()
        col = get_company_collection(db, company_id, "mcp_connections")

        connection.id = f"mcp_{uuid.uuid4().hex[:12]}"
        connection.created_by = user_id
        connection.connected_at = datetime.now(timezone.utc).isoformat()

        # Encrypt credentials before storing
        if connection.encrypted_credentials:
            connection.encrypted_credentials = self._encrypt(
                connection.encrypted_credentials
            )

        # Try to discover tools
        try:
            tools = await self._discover_tools(connection)
            connection.tools = tools
            connection.status = "connected"
        except Exception as e:
            connection.status = "error"
            connection.tools = []

        col.document(connection.id).set(connection.model_dump())
        return connection

    async def list_connections(self, company_id: str) -> list[MCPConnection]:
        """List all MCP connections for a company."""
        db = get_db()
        col = get_company_collection(db, company_id, "mcp_connections")
        docs = col.stream()
        connections = []
        for doc in docs:
            data = doc.to_dict()
            # Don't expose encrypted credentials to client
            data["encrypted_credentials"] = "***" if data.get("encrypted_credentials") else ""
            connections.append(MCPConnection(**data))
        return connections

    async def get_connection(self, company_id: str, connection_id: str) -> MCPConnection | None:
        db = get_db()
        col = get_company_collection(db, company_id, "mcp_connections")
        doc = col.document(connection_id).get()
        if not doc.exists:
            return None
        return MCPConnection(**doc.to_dict())

    async def delete_connection(self, company_id: str, connection_id: str) -> bool:
        db = get_db()
        col = get_company_collection(db, company_id, "mcp_connections")
        doc = col.document(connection_id).get()
        if not doc.exists:
            return False
        # Cleanup session if exists
        self._sessions.pop(connection_id, None)
        col.document(connection_id).delete()
        return True

    async def test_connection(self, company_id: str, connection_id: str) -> dict:
        """Test if an MCP connection is alive."""
        conn = await self.get_connection(company_id, connection_id)
        if not conn:
            return {"success": False, "error": "Connection not found"}

        try:
            tools = await self._discover_tools(conn)
            # Update status in Firestore
            db = get_db()
            col = get_company_collection(db, company_id, "mcp_connections")
            col.document(connection_id).update({
                "status": "connected",
                "tools": [t.model_dump() for t in tools],
            })
            return {"success": True, "tool_count": len(tools)}
        except Exception as e:
            db = get_db()
            col = get_company_collection(db, company_id, "mcp_connections")
            col.document(connection_id).update({"status": "error"})
            return {"success": False, "error": str(e)}

    async def refresh_tools(self, company_id: str, connection_id: str) -> list[MCPToolInfo]:
        """Re-discover tools for a connection."""
        conn = await self.get_connection(company_id, connection_id)
        if not conn:
            return []

        tools = await self._discover_tools(conn)
        db = get_db()
        col = get_company_collection(db, company_id, "mcp_connections")
        col.document(connection_id).update({
            "tools": [t.model_dump() for t in tools],
            "status": "connected",
        })
        return tools

    # ---- Tool operations ----

    async def list_all_tools(self, company_id: str) -> list[MCPToolInfo]:
        """Get all tools from all enabled connections."""
        connections = await self.list_connections(company_id)
        all_tools = []
        for conn in connections:
            if conn.enabled and conn.status == "connected":
                for tool in conn.tools:
                    tool.connection_id = conn.id
                    all_tools.append(tool)
        return all_tools

    async def call_tool(
        self,
        company_id: str,
        connection_id: str,
        tool_name: str,
        arguments: dict,
    ) -> MCPToolCallResult:
        """Execute a tool call via MCP protocol."""
        conn = await self.get_connection(company_id, connection_id)
        if not conn:
            return MCPToolCallResult(
                success=False, error="Connection not found"
            )

        start_time = time.time()

        try:
            result = await self._execute_tool_call(conn, tool_name, arguments)
            elapsed_ms = int((time.time() - start_time) * 1000)
            return MCPToolCallResult(
                success=True,
                result=result,
                execution_time_ms=elapsed_ms,
            )
        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            return MCPToolCallResult(
                success=False,
                error=str(e),
                execution_time_ms=elapsed_ms,
            )

    # ---- MCP Protocol implementation ----

    async def _discover_tools(self, conn: MCPConnection) -> list[MCPToolInfo]:
        """Connect to MCP server and discover available tools.
        Uses the official MCP SDK's ClientSession over SSE transport."""
        from mcp.client.sse import sse_client
        from mcp import ClientSession

        tools = []
        timeout = MCP_CONNECTION_TIMEOUT

        try:
            headers = self._build_auth_headers(conn)
            async with sse_client(
                url=conn.server_url,
                headers=headers,
                timeout=timeout,
            ) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    result = await session.list_tools()
                    for tool in result.tools:
                        tools.append(MCPToolInfo(
                            name=tool.name,
                            description=tool.description or "",
                            parameters=tool.inputSchema if tool.inputSchema else {},
                            connection_id=conn.id,
                        ))
        except Exception:
            # If SSE fails, try to treat as a simple REST-based tool server
            tools = await self._discover_tools_rest(conn)

        return tools

    async def _discover_tools_rest(self, conn: MCPConnection) -> list[MCPToolInfo]:
        """Fallback: discover tools from a REST-style MCP server."""
        import httpx

        headers = self._build_auth_headers(conn)
        try:
            async with httpx.AsyncClient(timeout=MCP_CONNECTION_TIMEOUT) as client:
                resp = await client.get(
                    f"{conn.server_url.rstrip('/')}/tools",
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
                tools_data = data if isinstance(data, list) else data.get("tools", [])
                return [
                    MCPToolInfo(
                        name=t.get("name", ""),
                        description=t.get("description", ""),
                        parameters=t.get("inputSchema", t.get("parameters", {})),
                        connection_id=conn.id,
                    )
                    for t in tools_data
                ]
        except Exception:
            return []

    async def _execute_tool_call(
        self, conn: MCPConnection, tool_name: str, arguments: dict
    ) -> dict | list | str:
        """Execute a tool call on an MCP server."""
        from mcp.client.sse import sse_client
        from mcp import ClientSession

        try:
            headers = self._build_auth_headers(conn)
            async with sse_client(
                url=conn.server_url,
                headers=headers,
                timeout=MCP_CONNECTION_TIMEOUT,
            ) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    result = await session.call_tool(tool_name, arguments)
                    # Extract text content from result
                    if result.content:
                        texts = [
                            c.text for c in result.content
                            if hasattr(c, "text")
                        ]
                        if len(texts) == 1:
                            # Try to parse as JSON
                            import json
                            try:
                                return json.loads(texts[0])
                            except (json.JSONDecodeError, TypeError):
                                return texts[0]
                        return {"content": texts}
                    return {"content": []}
        except Exception:
            # Fallback to REST
            return await self._execute_tool_call_rest(conn, tool_name, arguments)

    async def _execute_tool_call_rest(
        self, conn: MCPConnection, tool_name: str, arguments: dict
    ) -> dict | list | str:
        """Fallback: execute tool call via REST."""
        import httpx

        headers = self._build_auth_headers(conn)
        headers["Content-Type"] = "application/json"
        async with httpx.AsyncClient(timeout=MCP_CONNECTION_TIMEOUT) as client:
            resp = await client.post(
                f"{conn.server_url.rstrip('/')}/tools/{tool_name}",
                headers=headers,
                json={"arguments": arguments},
            )
            resp.raise_for_status()
            return resp.json()

    def _build_auth_headers(self, conn: MCPConnection) -> dict[str, str]:
        """Build authentication headers for MCP server."""
        headers: dict[str, str] = {}
        if conn.auth_type == "none" or not conn.encrypted_credentials:
            return headers

        creds = self._decrypt(conn.encrypted_credentials)

        if conn.auth_type == "api_key":
            headers["X-API-Key"] = creds
        elif conn.auth_type == "bearer":
            headers["Authorization"] = f"Bearer {creds}"
        elif conn.auth_type == "oauth":
            headers["Authorization"] = f"Bearer {creds}"

        return headers


# Singleton
_manager: MCPManager | None = None


def get_mcp_manager() -> MCPManager:
    global _manager
    if _manager is None:
        _manager = MCPManager()
    return _manager
