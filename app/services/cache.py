import hashlib
import json
import redis.asyncio as redis
from typing import Optional
from app.core.config import settings


_redis_client: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


def generate_cache_key(prompt: str, model: str, temperature: float, max_tokens: int) -> str:
    content = f"{prompt}:{model}:{temperature}:{max_tokens}"
    return f"llm_cache:{hashlib.sha256(content.encode()).hexdigest()}"


async def get_cached_response(cache_key: str) -> Optional[dict]:
    try:
        client = get_redis()
        data = await client.get(cache_key)
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


async def set_cached_response(cache_key: str, response: dict, ttl: int = 3600) -> bool:
    try:
        client = get_redis()
        await client.setex(cache_key, ttl, json.dumps(response))
        return True
    except Exception:
        return False


async def invalidate_cache(pattern: str = "llm_cache:*") -> int:
    try:
        client = get_redis()
        keys = await client.keys(pattern)
        if keys:
            return await client.delete(*keys)
    except Exception:
        pass
    return 0