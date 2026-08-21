import httpx
import time
import json
from typing import AsyncGenerator
from app.services.providers.base import LLMProvider
from app.core.config import settings
from app.services import runtime_settings


class OllamaProvider(LLMProvider):
    @property
    def name(self) -> str:
        return "ollama"

    @property
    def supported_models(self) -> list[str]:
        return ["llama3.1", "llama3", "mistral", "codellama", "phi3", "gemma2"]

    def _get_base_url(self) -> str:
        return runtime_settings.get_setting("ollama_base_url") or settings.ollama_base_url or "http://localhost:11434"

    async def chat_completion(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 4096,
        temperature: float = 0.7,
        stream: bool = False
    ) -> dict:
        payload = {
            "model": model,
            "messages": messages,
            "options": {
                "num_predict": max_tokens,
                "temperature": temperature
            },
            "stream": stream
        }

        start_time = time.time()
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self._get_base_url()}/api/chat",
                json=payload
            )
            latency_ms = int((time.time() - start_time) * 1000)

        response.raise_for_status()
        data = response.json()

        if "message" in data:
            content = data["message"]["content"]
        else:
            content = data.get("response", "")

        prompt_eval = data.get("prompt_eval_count", 0)
        eval_count = data.get("eval_count", 0)

        return {
            "content": content,
            "model": model,
            "prompt_tokens": prompt_eval,
            "completion_tokens": eval_count,
            "total_tokens": prompt_eval + eval_count,
            "latency_ms": latency_ms
        }

    async def chat_completion_stream(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 4096,
        temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        payload = {
            "model": model,
            "messages": messages,
            "options": {
                "num_predict": max_tokens,
                "temperature": temperature
            },
            "stream": True
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self._get_base_url()}/api/chat",
                json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.strip():
                        try:
                            chunk = json.loads(line)
                            if "message" in chunk:
                                content = chunk["message"].get("content", "")
                                if content:
                                    yield content
                            elif "response" in chunk:
                                yield chunk["response"]
                            if chunk.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue

    def calculate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        return 0.0