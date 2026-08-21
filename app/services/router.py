from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import ModelConfig, ComplexityLevel, User
from app.services.complexity import score_complexity
from app.services.llm_complexity import score_complexity_llm
from app.services.budget import get_budget_status
from app.core.config import settings
from app.services import runtime_settings


OLLAMA_DEFAULTS = {
    ComplexityLevel.LOW: {"model_name": "mistral:latest", "is_default": True},
    ComplexityLevel.MEDIUM: {"model_name": "llama3.2:latest", "is_default": False},
    ComplexityLevel.HIGH: {"model_name": "llama3.1:latest", "is_default": False},
}

OPENROUTER_DEFAULTS = {
    ComplexityLevel.LOW: {"model_name": "openrouter/quasar-alpha", "is_default": True},
    ComplexityLevel.MEDIUM: {"model_name": "anthropic/claude-3.5-sonnet", "is_default": False},
    ComplexityLevel.HIGH: {"model_name": "openai/o3-mini", "is_default": False},
}

NVIDIA_DEFAULTS = {
    ComplexityLevel.LOW: {"model_name": "meta/llama-3.1-8b-instruct", "is_default": True},
    ComplexityLevel.MEDIUM: {"model_name": "meta/llama-3.1-70b-instruct", "is_default": False},
    ComplexityLevel.HIGH: {"model_name": "meta/llama-3.1-405b-instruct", "is_default": False},
}

MISTRAL_DEFAULTS = {
    ComplexityLevel.LOW: {"model_name": "mistral-small-latest", "is_default": True},
    ComplexityLevel.MEDIUM: {"model_name": "mistral-medium-latest", "is_default": False},
    ComplexityLevel.HIGH: {"model_name": "mistral-large-latest", "is_default": False},
}

GEMINI_DEFAULTS = {
    ComplexityLevel.LOW: {"model_name": "gemini-2.0-flash", "is_default": True},
    ComplexityLevel.MEDIUM: {"model_name": "gemini-2.5-flash", "is_default": False},
    ComplexityLevel.HIGH: {"model_name": "gemini-2.5-pro", "is_default": False},
}

PROVIDER_DEFAULTS = {
    "ollama": OLLAMA_DEFAULTS,
    "openrouter": OPENROUTER_DEFAULTS,
    "nvidia": NVIDIA_DEFAULTS,
    "mistral": MISTRAL_DEFAULTS,
    "gemini": GEMINI_DEFAULTS,
}


async def ensure_model_configs_for_provider(db: AsyncSession, user_id: int, provider: str) -> None:
    defaults = PROVIDER_DEFAULTS.get(provider, OPENROUTER_DEFAULTS)
    for complexity, cfg in defaults.items():
        existing = await get_model_for_complexity(db, user_id, complexity, provider_filter=provider)
        if not existing:
            db.add(ModelConfig(
                user_id=user_id,
                complexity=complexity,
                model_name=cfg["model_name"],
                provider=provider,
                is_default=cfg["is_default"],
            ))
    await db.commit()


async def get_model_for_complexity(
    db: AsyncSession,
    user_id: int,
    complexity: ComplexityLevel,
    provider_filter: str | None = None,
) -> ModelConfig | None:
    query = select(ModelConfig).where(
        ModelConfig.user_id == user_id,
        ModelConfig.complexity == complexity,
    )
    if provider_filter:
        query = query.where(ModelConfig.provider == provider_filter)
    query = query.order_by(ModelConfig.is_default.desc())
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_cheapest_model(db: AsyncSession, user_id: int, provider_filter: str | None = None) -> ModelConfig | None:
    query = select(ModelConfig).where(ModelConfig.user_id == user_id)
    if provider_filter:
        query = query.where(ModelConfig.provider == provider_filter)
    query = query.order_by(ModelConfig.complexity)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_default_model(db: AsyncSession, user_id: int, provider_filter: str | None = None) -> ModelConfig | None:
    query = select(ModelConfig).where(
        ModelConfig.user_id == user_id,
        ModelConfig.is_default == True,
    )
    if provider_filter:
        query = query.where(ModelConfig.provider == provider_filter)
    result = await db.execute(query)
    config = result.scalar_one_or_none()
    if config:
        return config

    query = select(ModelConfig).where(ModelConfig.user_id == user_id)
    if provider_filter:
        query = query.where(ModelConfig.provider == provider_filter)
    query = query.order_by(ModelConfig.complexity)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def score_complexity_hybrid(prompt: str) -> ComplexityLevel:
    if settings.use_llm_complexity:
        return await score_complexity_llm(prompt)
    return score_complexity(prompt)


async def route_request(
    db: AsyncSession,
    user_id: int,
    prompt: str,
    complexity: ComplexityLevel | None = None,
) -> tuple[ModelConfig, ComplexityLevel]:
    if complexity is None:
        complexity = await score_complexity_hybrid(prompt)

    default_provider = runtime_settings.get_setting("default_provider") or settings.default_provider or "ollama"

    await ensure_model_configs_for_provider(db, user_id, default_provider)

    budget_status = await get_budget_status(db, user_id)
    budget_percent = budget_status.get("percent_used", 0)

    if budget_percent >= 95:
        model_config = await get_cheapest_model(db, user_id, provider_filter=default_provider)
        if model_config:
            return model_config, complexity
    elif budget_percent >= 80:
        if complexity == ComplexityLevel.HIGH:
            model_config = await get_model_for_complexity(db, user_id, ComplexityLevel.MEDIUM, provider_filter=default_provider)
            if model_config:
                return model_config, ComplexityLevel.MEDIUM
        elif complexity == ComplexityLevel.MEDIUM:
            model_config = await get_model_for_complexity(db, user_id, ComplexityLevel.LOW, provider_filter=default_provider)
            if model_config:
                return model_config, ComplexityLevel.LOW

    model_config = await get_model_for_complexity(db, user_id, complexity, provider_filter=default_provider)

    if not model_config:
        model_config = await get_default_model(db, user_id, provider_filter=default_provider)

    if not model_config and default_provider != "ollama":
        model_config = await get_default_model(db, user_id, provider_filter="ollama")

    if not model_config:
        model_config = await get_default_model(db, user_id)

    if not model_config:
        defaults = PROVIDER_DEFAULTS.get(default_provider, OPENROUTER_DEFAULTS)
        fallback_cfg = defaults[complexity]
        fallback = ModelConfig(
            user_id=user_id,
            complexity=complexity,
            model_name=fallback_cfg["model_name"],
            provider=default_provider,
            is_default=True,
        )
        db.add(fallback)
        await db.commit()
        await db.refresh(fallback)
        return fallback, complexity

    return model_config, complexity