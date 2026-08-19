from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import ModelConfig, ComplexityLevel, User
from app.services.complexity import score_complexity
from app.services.llm_complexity import score_complexity_llm
from app.services.budget import get_budget_status
from app.core.config import settings


async def get_model_for_complexity(db: AsyncSession, user_id: int, complexity: ComplexityLevel) -> ModelConfig | None:
    result = await db.execute(
        select(ModelConfig)
        .where(ModelConfig.user_id == user_id, ModelConfig.complexity == complexity)
        .order_by(ModelConfig.is_default.desc())
    )
    return result.scalar_one_or_none()


async def get_cheapest_model(db: AsyncSession, user_id: int) -> ModelConfig | None:
    result = await db.execute(
        select(ModelConfig)
        .where(ModelConfig.user_id == user_id)
        .order_by(ModelConfig.complexity)
    )
    return result.scalar_one_or_none()


async def get_default_model(db: AsyncSession, user_id: int) -> ModelConfig | None:
    result = await db.execute(
        select(ModelConfig)
        .where(ModelConfig.user_id == user_id, ModelConfig.is_default == True)
    )
    config = result.scalar_one_or_none()
    if config:
        return config
    
    result = await db.execute(
        select(ModelConfig)
        .where(ModelConfig.user_id == user_id)
        .order_by(ModelConfig.complexity)
    )
    return result.scalar_one_or_none()


async def score_complexity_hybrid(prompt: str) -> ComplexityLevel:
    if settings.use_llm_complexity:
        return await score_complexity_llm(prompt)
    return score_complexity(prompt)


async def route_request(db: AsyncSession, user_id: int, prompt: str) -> tuple[ModelConfig, ComplexityLevel]:
    complexity = await score_complexity_hybrid(prompt)
    
    budget_status = await get_budget_status(db, user_id)
    budget_percent = budget_status.get("percent_used", 0)
    
    if budget_percent >= 95:
        model_config = await get_cheapest_model(db, user_id)
        if model_config:
            return model_config, complexity
    elif budget_percent >= 80:
        if complexity == ComplexityLevel.HIGH:
            model_config = await get_model_for_complexity(db, user_id, ComplexityLevel.MEDIUM)
            if model_config:
                return model_config, ComplexityLevel.MEDIUM
        elif complexity == ComplexityLevel.MEDIUM:
            model_config = await get_model_for_complexity(db, user_id, ComplexityLevel.LOW)
            if model_config:
                return model_config, ComplexityLevel.LOW
    
    model_config = await get_model_for_complexity(db, user_id, complexity)
    
    if not model_config:
        model_config = await get_default_model(db, user_id)
    
    if not model_config:
        raise ValueError("No model configuration found for user")
    
    return model_config, complexity