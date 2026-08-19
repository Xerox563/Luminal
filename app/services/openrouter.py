import httpx
import time
from app.core.config import settings
from typing import Optional


async def call_openrouter(
    model: str,
    messages: list[dict],
    max_tokens: int = 4096,
    temperature: float = 0.7,
    api_key: Optional[str] = None
) -> dict:
    headers = {
        "Authorization": f"Bearer {api_key or settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "Luminal"
    }
    
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature
    }
    
    start_time = time.time()
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.openrouter_base_url}/chat/completions",
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


def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    pricing = {
        "anthropic/claude-3-haiku": {"input": 0.25, "output": 1.25},
        "anthropic/claude-3-sonnet": {"input": 3.0, "output": 15.0},
        "anthropic/claude-3-opus": {"input": 15.0, "output": 75.0},
        "openai/gpt-4o": {"input": 5.0, "output": 15.0},
        "openai/gpt-4o-mini": {"input": 0.15, "output": 0.6},
        "openai/gpt-3.5-turbo": {"input": 0.5, "output": 1.5},
    }
    
    model_pricing = pricing.get(model, {"input": 1.0, "output": 2.0})
    input_cost = (prompt_tokens / 1_000_000) * model_pricing["input"]
    output_cost = (completion_tokens / 1_000_000) * model_pricing["output"]
    return round(input_cost + output_cost, 6)