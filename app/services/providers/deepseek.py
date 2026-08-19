import httpx
import time
import json
from typing import AsyncGenerator
from app.services.providers.base import LLMProvider
from app.core.config import settings


class DeepSeekProvider(LLMProvider):
    @property
    def name(self) -> str:
        return "deepseek"

    @property
    def supported_models(self) -> list[str]:
        return ["deepseek-chat", "deepseek-coder"]

    def _get_api_key(self) -> str:
        return settings.deepseek_api_key or settings.openrouter_api_key

    def _get_base_url(self) -> str:
        return settings.deepseek_base_url or "https://api.deepseek.com/v1"

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
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": stream
        }

        start_time = time.time()
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self._get_base_url()}/chat/completions",
                headers=headers,
                json=payload
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
            "latency_ms": latency_ms
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
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{self._get_base_url()}/chat/completions",
                headers=headers,
                json=payload
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
            "deepseek-chat": {"input": 0.14, "output": 0.28},
            "deepseek-coder": {"input": 0.14, "output": 0.28},
        }
        model_pricing = pricing.get(model, {"input": 0.14, "output": 0.28})
        input_cost = (prompt_tokens / 1_000_000) * model_pricing["input"]
        output_cost = (completion_tokens / 1_000_000) * model_pricing["output"]
        return round(input_cost + output_cost, 6)