import httpx
import time
import json
from typing import AsyncGenerator
from app.services.providers.base import LLMProvider
from app.core.config import settings
from app.services import runtime_settings


class OpenRouterProvider(LLMProvider):
    """Provider that routes through OpenRouter (single key, many models)."""

    @property
    def name(self) -> str:
        return "openrouter"

    @property
    def supported_models(self) -> list[str]:
        return [
            "openai/gpt-4o", "openai/gpt-4o-mini", "openai/gpt-4-turbo", "openai/gpt-4",
            "openai/gpt-3.5-turbo", "openai/gpt-3.5-turbo-16k",
            "anthropic/claude-3-opus", "anthropic/claude-3-sonnet",
            "anthropic/claude-3-haiku", "anthropic/claude-3.5-sonnet",
            "deepseek/deepseek-chat", "deepseek/deepseek-reasoner",
        ]

    def _get_api_key(self) -> str:
        return runtime_settings.get_setting("openrouter_api_key") or settings.openrouter_api_key

    def _get_base_url(self) -> str:
        return runtime_settings.get_setting("openrouter_base_url") or settings.openrouter_base_url or "https://openrouter.ai/api/v1"

    async def chat_completion(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 4096,
        temperature: float = 0.7,
        stream: bool = False
    ) -> dict:
        headers = {
            "Authorization": f"Bearer {self._get_api_key()}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "Luminal",
        }
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        start_time = time.time()
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self._get_base_url()}/chat/completions",
                headers=headers,
                json=payload,
            )
            latency_ms = int((time.time() - start_time) * 1000)

        response.raise_for_status()
        data = response.json()

        choice = data["choices"][0]
        usage = data.get("usage", {})

        return {
            "content": choice["message"]["content"],
            "model": data.get("model", model),
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0),
            "latency_ms": latency_ms,
        }

    async def chat_completion_stream(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 4096,
        temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        headers = {
            "Authorization": f"Bearer {self._get_api_key()}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "Luminal",
        }
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self._get_base_url()}/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk["choices"][0].get("delta", {})
                            if "content" in delta:
                                yield delta["content"]
                        except json.JSONDecodeError:
                            continue

    def calculate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        pricing = {
            "anthropic/claude-3-haiku": {"input": 0.25, "output": 1.25},
            "anthropic/claude-3-sonnet": {"input": 3.0, "output": 15.0},
            "anthropic/claude-3-opus": {"input": 15.0, "output": 75.0},
            "anthropic/claude-3.5-sonnet": {"input": 3.0, "output": 15.0},
            "openai/gpt-4o": {"input": 5.0, "output": 15.0},
            "openai/gpt-4o-mini": {"input": 0.15, "output": 0.6},
            "openai/gpt-4-turbo": {"input": 10.0, "output": 30.0},
            "openai/gpt-4": {"input": 30.0, "output": 60.0},
            "openai/gpt-3.5-turbo": {"input": 0.5, "output": 1.5},
            "openai/gpt-3.5-turbo-16k": {"input": 3.0, "output": 4.0},
            "deepseek/deepseek-chat": {"input": 0.27, "output": 1.1},
            "deepseek/deepseek-reasoner": {"input": 0.55, "output": 2.19},
        }
        model_pricing = pricing.get(model, {"input": 1.0, "output": 2.0})
        input_cost = (prompt_tokens / 1_000_000) * model_pricing["input"]
        output_cost = (completion_tokens / 1_000_000) * model_pricing["output"]
        return round(input_cost + output_cost, 6)