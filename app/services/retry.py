import asyncio
import random
from typing import Callable, Any, Optional, List
from app.models import ModelConfig, ComplexityLevel
from app.services.providers import ProviderRegistry


async def retry_with_backoff(
    func: Callable,
    *args,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    **kwargs
) -> Any:
    last_exception = None
    
    for attempt in range(max_retries):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            last_exception = e
            if attempt < max_retries - 1:
                delay = min(base_delay * (2 ** attempt) + random.uniform(0, 1), max_delay)
                await asyncio.sleep(delay)
    
    raise last_exception


async def get_fallback_models(db, user_id: int, current_model: ModelConfig) -> List[ModelConfig]:
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select
    from app.models import ModelConfig, ComplexityLevel
    
    result = await db.execute(
        select(ModelConfig)
        .where(ModelConfig.user_id == user_id)
        .where(ModelConfig.id != current_model.id)
        .order_by(ModelConfig.complexity)
    )
    return result.scalars().all()


async def execute_with_fallback(
    db,
    user_id: int,
    prompt: str,
    model_config: ModelConfig,
    messages: list[dict],
    max_tokens: int,
    temperature: float
) -> dict:
    try:
        return await retry_with_backoff(
            _call_provider,
            model_config,
            messages,
            max_tokens,
            temperature
        )
    except Exception:
        fallback_models = await get_fallback_models(db, user_id, model_config)
        
        for fallback_model in fallback_models:
            try:
                return await retry_with_backoff(
                    _call_provider,
                    fallback_model,
                    messages,
                    max_tokens,
                    temperature
                )
            except Exception:
                continue
        
        raise


async def _call_provider(
    model_config: ModelConfig,
    messages: list[dict],
    max_tokens: int,
    temperature: float
) -> dict:
    provider = ProviderRegistry.get(model_config.provider)
    if not provider:
        provider = ProviderRegistry.get_for_model(model_config.model_name)
    if not provider:
        provider = ProviderRegistry.get("openrouter")
    
    if not provider:
        raise ValueError(f"No provider found for model {model_config.model_name}")
    
    return await provider.chat_completion(
        model=model_config.model_name,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature
    )