"""
AI Provider registry.
Register providers here. The active provider is selected via config.
"""

from __future__ import annotations
from app.config import AI_PROVIDER
from .base import AIProvider
from .gemini import GeminiProvider

_providers: dict[str, type[AIProvider]] = {
    "gemini": GeminiProvider,
}

_instance: AIProvider | None = None


def register_provider(name: str, cls: type[AIProvider]):
    """Register a custom AI provider."""
    _providers[name] = cls


def get_ai() -> AIProvider:
    """Get the configured AI provider instance."""
    global _instance
    if _instance is None:
        provider_cls = _providers.get(AI_PROVIDER)
        if not provider_cls:
            raise ValueError(
                f"Unknown AI provider: {AI_PROVIDER}. "
                f"Available: {list(_providers.keys())}"
            )
        _instance = provider_cls()
    return _instance


def reset():
    """Reset cached instance (for testing / config changes)."""
    global _instance
    _instance = None
