import os
from dotenv import load_dotenv

load_dotenv()

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

# AI Provider
AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini")  # "gemini" | "claude" | "openai" | ...
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Google Sheets (Phase 2)
GOOGLE_SHEETS_CREDENTIALS_PATH = os.getenv("GOOGLE_SHEETS_CREDENTIALS_PATH", "")

# MCP Integration
COMPOSIO_API_KEY = os.getenv("COMPOSIO_API_KEY", "")
MCP_ENCRYPTION_KEY = os.getenv("MCP_ENCRYPTION_KEY", "")  # Fernet key for credential encryption
MCP_CONNECTION_TIMEOUT = int(os.getenv("MCP_CONNECTION_TIMEOUT", "30"))
