"""
AI Provider abstraction layer.
Any AI model (Gemini, Claude, GPT, local models) implements this interface.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Literal


@dataclass
class AIMessage:
    role: Literal["user", "assistant", "system"]
    content: str
    images: list[bytes] = field(default_factory=list)  # For multimodal


@dataclass
class AIResponse:
    text: str
    usage: dict = field(default_factory=dict)  # token counts etc.
    raw: dict = field(default_factory=dict)  # provider-specific raw response


@dataclass
class ImageGenerationResult:
    image_bytes: bytes
    mime_type: str = "image/png"
    prompt_used: str = ""


class AIProvider(ABC):
    """Abstract base for all AI providers."""

    @abstractmethod
    async def chat(self, messages: list[AIMessage], **kwargs) -> AIResponse:
        """Send a chat completion request."""
        ...

    @abstractmethod
    async def generate_structured(
        self, prompt: str, schema: dict, **kwargs
    ) -> dict:
        """Generate structured JSON output conforming to a schema."""
        ...

    async def analyze_image(self, image: bytes, prompt: str, **kwargs) -> AIResponse:
        """Analyze an image with a text prompt. Override if supported."""
        raise NotImplementedError(f"{self.__class__.__name__} does not support image analysis")

    async def generate_image(self, prompt: str, **kwargs) -> ImageGenerationResult:
        """Generate an image from a text prompt. Override if supported."""
        raise NotImplementedError(f"{self.__class__.__name__} does not support image generation")

    @abstractmethod
    def supports_feature(self, feature: str) -> bool:
        """Check if this provider supports a given feature.
        Features: 'chat', 'structured_output', 'image_analysis', 'image_generation', 'code_execution'
        """
        ...
