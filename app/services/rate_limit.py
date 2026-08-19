import time
import redis.asyncio as redis
from typing import Optional
from app.core.config import settings


_redis_client: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


async def check_rate_limit(
    key: str,
    limit: int,
    window: int
) -> tuple[bool, int, int]:
    client = get_redis()
    current = int(time.time())
    window_start = current - window
    
    pipe = client.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)
    pipe.zcard(key)
    pipe.zadd(key, {str(current): current})
    pipe.expire(key, window)
    results = await pipe.execute()
    
    current_count = results[1]
    
    if current_count >= limit:
        return False, current_count, limit
    
    return True, current_count + 1, limit


async def get_rate_limit_status(key: str, limit: int, window: int) -> dict:
    client = get_redis()
    current = int(time.time())
    window_start = current - window
    
    await client.zremrangebyscore(key, 0, window_start)
    count = await client.zcard(key)
    
    return {
        "limit": limit,
        "remaining": max(0, limit - count),
        "reset": current + window,
        "used": count
    }