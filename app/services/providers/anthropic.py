import httpx
import time
import json
from typing import AsyncGenerator
from app.services.providers.base import LLMProvider
from app.core.config import settings


class AnthropicProvider(LLMProvider):
    @property
    def name(self) -> str:
        return "anthropic"

    @property
    def supported_models(self) -> list[str]:
        return [
            "claude-3-opus-20240229", "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307", "claude-3-5-sonnet-20241022"
        ]

    def _get_api_key(self) -> str:
        return settings.anthropic_api_key or settings.openrouter_api_key

    def _get_base_url(self) -> str:
        return settings.anthropic_base_url or "https://api.anthropic.com/v1"

    def _convert_messages(self, messages: list[dict]) -> tuple[str, list[dict]]:
        system = ""
        converted = []
        for msg in messages:
            if msg["role"] == "system":
                system = msg["content"]
            else:
                converted.append({"role": msg["role"], "content": msg["content"]})
        return system, converted

    async def chat_completion(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 4096,
        temperature: float = 0.7,
        stream: bool = False
    ) -> dict:
        system, converted_messages = self._convert_messages(messages)
        
        headers = {
            "x-api-key": self._get_api_key(),
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }
        payload = {
            "model": model,
            "messages": converted_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": stream
        }
        if system:
            payload["system"] = system

        start_time = time.time()
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self._get_base_url()}/messages",
                headers=headers,
                json=payload
            )
            latency_ms = int((time.time() - start_time) * 1000)

        response.raise_for_status()
        data = response.json()

        usage = data.get("usage", {})
        content = "".join([block["text"] for block in data.get("content", [])])

        return {
            "content": content,
            "model": data.get("model", model),
            "prompt_tokens": usage.get("input_tokens", 0),
            "completion_tokens": usage.get("output_tokens", 0),
            "total_tokens": usage.get("input_tokens", 0) + usage.get("output_tokens", 0),
            "latency_ms": latency_ms
        }

    async def chat_completion_stream(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 4096,
        temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        system, converted_messages = self._convert_messages(messages)
        
        headers = {
            "x-api-key": self._get_api_key(),
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }
        payload = {
            "model": model,
            "messages": converted_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{self._get_base_url()}/messages",
                headers=headers,
                json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        try:
                            chunk = json.loads(data)
                            if chunk.get("type") == "content_block_delta":
                                delta = chunk.get("delta", {})
                                if delta.get("type") == "text_delta":
                                    yield delta.get("text", "")
                        except json.JSONDecodeError:
                            continue

    def calculate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        pricing = {
            "claude-3-opus-20240229": {"input": 15.0, "output": 75.0},
            "claude-3-sonnet-20240229": {"input": 3.0, "output": 15.0},
            "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},
            "claude-3-5-sonnet-20241022": {"input": 3.0, "output": 15.0},
        }
        model_pricing = pricing.get(model, {"input": 1.0, "output": 2.0})
        input_cost = (prompt_tokens / 1_000_000) * model_pricing["input"]
        output_cost = (completion_tokens / 1_000_000) * model_pricing["output"]
        return round(input_cost + output_cost, 6)