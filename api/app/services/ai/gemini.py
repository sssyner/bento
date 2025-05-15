"""
Gemini AI provider implementation.
Supports: chat, structured output, image analysis, image generation.
"""

from __future__ import annotations
import base64
import json
import httpx
from app.config import GEMINI_API_KEY, GEMINI_MODEL
from .base import AIProvider, AIMessage, AIResponse, ImageGenerationResult


class GeminiProvider(AIProvider):
    """Google Gemini API provider."""

    FEATURES = {"chat", "structured_output", "image_analysis", "image_generation", "code_execution"}

    def __init__(self, api_key: str = "", model: str = ""):
        self.api_key = api_key or GEMINI_API_KEY
        self.model = model or GEMINI_MODEL
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    def supports_feature(self, feature: str) -> bool:
        return feature in self.FEATURES

    async def chat(self, messages: list[AIMessage], **kwargs) -> AIResponse:
        contents = []
        system_instruction = None

        for msg in messages:
            if msg.role == "system":
                system_instruction = msg.content
                continue

            parts = [{"text": msg.content}]
            for img in msg.images:
                parts.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": base64.b64encode(img).decode(),
                    }
                })

            contents.append({
                "role": "user" if msg.role == "user" else "model",
                "parts": parts,
            })

        body: dict = {"contents": contents}
        if system_instruction:
            body["system_instruction"] = {"parts": [{"text": system_instruction}]}

        generation_config = {}
        if kwargs.get("temperature") is not None:
            generation_config["temperature"] = kwargs["temperature"]
        if kwargs.get("max_tokens"):
            generation_config["maxOutputTokens"] = kwargs["max_tokens"]
        if kwargs.get("response_mime_type"):
            generation_config["responseMimeType"] = kwargs["response_mime_type"]
        if kwargs.get("response_schema"):
            generation_config["responseSchema"] = kwargs["response_schema"]
        if generation_config:
            body["generationConfig"] = generation_config

        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            data = resp.json()

        text = ""
        if "candidates" in data and data["candidates"]:
            parts = data["candidates"][0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts)

        return AIResponse(
            text=text,
            usage=data.get("usageMetadata", {}),
            raw=data,
        )

    async def generate_structured(self, prompt: str, schema: dict, **kwargs) -> dict:
        resp = await self.chat(
            [AIMessage(role="user", content=prompt)],
            response_mime_type="application/json",
            response_schema=schema,
            **kwargs,
        )
        return json.loads(resp.text)

    async def analyze_image(self, image: bytes, prompt: str, **kwargs) -> AIResponse:
        return await self.chat(
            [AIMessage(role="user", content=prompt, images=[image])],
            **kwargs,
        )

    async def generate_image(self, prompt: str, **kwargs) -> ImageGenerationResult:
        """Generate image using Gemini's Imagen integration."""
        url = f"{self.base_url}/models/imagen-3.0-generate-002:predict?key={self.api_key}"
        body = {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": kwargs.get("aspect_ratio", "1:1"),
            },
        }

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            data = resp.json()

        predictions = data.get("predictions", [])
        if not predictions:
            raise RuntimeError("No image generated")

        img_b64 = predictions[0].get("bytesBase64Encoded", "")
        return ImageGenerationResult(
            image_bytes=base64.b64decode(img_b64),
            mime_type=predictions[0].get("mimeType", "image/png"),
            prompt_used=prompt,
        )
