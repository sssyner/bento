"""Pydantic models for MCP integration."""

from __future__ import annotations

from pydantic import BaseModel, Field


class MCPConnection(BaseModel):
    """A configured MCP server connection."""
    id: str = ""
    server_name: str
    server_url: str
    auth_type: str = "none"  # "none" | "api_key" | "oauth" | "bearer"
    encrypted_credentials: str = ""
    description: str = ""
    enabled: bool = True
    tools: list[MCPToolInfo] = Field(default_factory=list)
    connected_at: str = ""
    status: str = "disconnected"  # "connected" | "disconnected" | "error"
    created_by: str = ""
    service_id: str = ""  # Composio service identifier if applicable


class MCPToolInfo(BaseModel):
    """Discovered tool from an MCP server."""
    name: str
    description: str = ""
    parameters: dict = Field(default_factory=dict)  # JSON Schema
    connection_id: str = ""


class MCPToolCallRequest(BaseModel):
    """Request to call an MCP tool."""
    connection_id: str
    tool_name: str
    arguments: dict = Field(default_factory=dict)


class MCPToolCallResult(BaseModel):
    """Result from an MCP tool call."""
    success: bool
    result: dict | list | str | None = None
    error: str | None = None
    execution_time_ms: int = 0


class MCPService(BaseModel):
    """A service available via Composio catalog."""
    id: str
    name: str
    description: str = ""
    icon_url: str = ""
    auth_type: str = "oauth"
    categories: list[str] = Field(default_factory=list)
    available_tools: list[str] = Field(default_factory=list)


class MCPToolLog(BaseModel):
    """Log entry for an MCP tool execution."""
    id: str = ""
    connection_id: str
    tool_name: str
    arguments: dict = Field(default_factory=dict)
    result: dict | list | str | None = None
    success: bool = True
    execution_time_ms: int = 0
    called_by: str = ""
    called_at: str = ""
    context: str = ""  # "chat" | "workflow" | "manual"
