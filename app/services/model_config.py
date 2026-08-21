from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models import ModelConfig, ComplexityLevel, User
from typing import Optional, List


async def create_model_config(
    db: AsyncSession,
    user_id: int,
    complexity: ComplexityLevel,
    model_name: str,
    provider: str = "openrouter",
    max_tokens: int = 4096,
    temperature: float = 0.7,
    is_default: bool = False
) -> ModelConfig:
    if is_default:
        await db.execute(
            update(ModelConfig)
            .where(ModelConfig.user_id == user_id, ModelConfig.is_default == True)
            .values(is_default=False)
        )
    
    config = ModelConfig(
        user_id=user_id,
        complexity=complexity,
        model_name=model_name,
        provider=provider,
        max_tokens=max_tokens,
        temperature=temperature,
        is_default=is_default
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


async def get_model_config(db: AsyncSession, user_id: int, config_id: int) -> Optional[ModelConfig]:
    result = await db.execute(
        select(ModelConfig).where(
            ModelConfig.id == config_id,
            ModelConfig.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def get_model_configs(db: AsyncSession, user_id: int) -> List[ModelConfig]:
    result = await db.execute(
        select(ModelConfig).where(ModelConfig.user_id == user_id).order_by(ModelConfig.complexity)
    )
    return result.scalars().all()


async def update_model_config(db: AsyncSession, config: ModelConfig, data: dict) -> ModelConfig:
    if data.get("is_default"):
        await db.execute(
            update(ModelConfig)
            .where(ModelConfig.user_id == config.user_id, ModelConfig.is_default == True)
            .values(is_default=False)
        )
    
    for key, value in data.items():
        if value is not None and hasattr(config, key):
            setattr(config, key, value)
    config.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(config)
    return config


async def delete_model_config(db: AsyncSession, config: ModelConfig) -> None:
    await db.delete(config)
    await db.commit()


async def get_model_for_complexity(db: AsyncSession, user_id: int, complexity: ComplexityLevel) -> Optional[ModelConfig]:
    result = await db.execute(
        select(ModelConfig)
        .where(ModelConfig.user_id == user_id, ModelConfig.complexity == complexity)
        .order_by(ModelConfig.is_default.desc())
    )
    return result.scalar_one_or_none()


async def get_default_model(db: AsyncSession, user_id: int) -> Optional[ModelConfig]:
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


from datetime import datetime