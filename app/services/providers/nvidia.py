import httpx
import time
import json
from typing import AsyncGenerator
from app.services.providers.base import LLMProvider
from app.core.config import settings
from app.services import runtime_settings


class NvidiaProvider(LLMProvider):
    @property
    def name(self) -> str:
        return "nvidia"

    @property
    def supported_models(self) -> list[str]:
        return [
            "meta/llama-3.1-405b-instruct",
            "meta/llama-3.1-70b-instruct",
            "meta/llama-3.1-8b-instruct",
            "nvidia/llama-3.1-nemotron-70b-instruct",
            "mistralai/mixtral-8x22b-instruct-v0.1",
        ]

    def _get_api_key(self) -> str:
        return runtime_settings.get_setting("nvidia_api_key") or settings.nvidia_api_key

    def _get_base_url(self) -> str:
        return runtime_settings.get_setting("nvidia_base_url") or settings.nvidia_base_url or "https://integrate.api.nvidia.com/v1"

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
        # NVIDIA NIM hosted inference is currently free/credit-based (no per-token
        # billing API), so cost tracking here is a placeholder at $0 like Ollama.
        return 0.0
