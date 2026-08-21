from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Setting
from app.core.config import settings

# In-memory overrides loaded from the settings table at startup.
# These take precedence over .env values and apply without a restart.
_OVERIDES: dict[str, str] = {}

PROVIDER_KEYS = [
    "openrouter_api_key",
    "openai_api_key",
    "anthropic_api_key",
    "deepseek_api_key",
    "nvidia_api_key",
]

BASE_URLS = [
    "openrouter_base_url",
    "openai_base_url",
    "anthropic_base_url",
    "deepseek_base_url",
    "nvidia_base_url",
    "ollama_base_url",
]

BOOL_SETTINGS = [
    "use_llm_complexity",
]

ALL_SETTING_KEYS = PROVIDER_KEYS + BASE_URLS + BOOL_SETTINGS + ["default_provider"]


async def load_settings(db: AsyncSession) -> None:
    """Load all persisted overrides into memory. Called once at startup."""
    result = await db.execute(select(Setting))
    for row in result.scalars().all():
        _OVERIDES[row.key] = row.value or ""


async def set_setting(db: AsyncSession, key: str, value: Optional[str]) -> None:
    """Upsert a setting row and update the in-memory override."""
    result = await db.execute(select(Setting).where(Setting.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))
    await db.commit()
    if value:
        _OVERIDES[key] = value
    else:
        _OVERIDES.pop(key, None)


def get_setting(key: str) -> str:
    """Resolve a setting: DB override first, then .env/config default."""
    if key in _OVERIDES:
        return _OVERIDES[key]
    return getattr(settings, key, "") or ""


def set_setting_memory(key: str, value: Optional[str]) -> None:
    if value:
        _OVERIDES[key] = value
    else:
        _OVERIDES.pop(key, None)


def mask_value(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "••••"
    return f"{value[:4]}••••••••{value[-4:]}"


def settings_summary() -> dict:
    """Returns masked values (safe to send to the dashboard)."""
    out: dict[str, str] = {}
    for key in ALL_SETTING_KEYS:
        v = get_setting(key)
        if key in PROVIDER_KEYS and v:
            out[key] = mask_value(v)
        elif key == "use_llm_complexity":
            out[key] = "true" if v in ("1", "true", "True", "on") else "false"
        else:
            out[key] = v
    return out