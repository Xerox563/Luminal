import secrets
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User, APIKey
from app.services.auth import hash_api_key, verify_api_key
from app.schemas.api_key import APIKeyCreate, APIKeyUpdate
from datetime import datetime, timedelta


async def create_api_key(db: AsyncSession, user_id: int, name: str) -> tuple[str, APIKey]:
    raw_key = f"lum_{secrets.token_urlsafe(32)}"
    key_hash = hash_api_key(raw_key)
    
    api_key = APIKey(
        user_id=user_id,
        key_hash=key_hash,
        name=name,
        is_active=True,
        expires_at=datetime.utcnow() + timedelta(days=365)
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    
    return raw_key, api_key


async def get_api_keys(db: AsyncSession, user_id: int) -> list[APIKey]:
    result = await db.execute(
        select(APIKey).where(APIKey.user_id == user_id).order_by(APIKey.created_at.desc())
    )
    return result.scalars().all()


async def get_api_key_by_id(db: AsyncSession, user_id: int, key_id: int) -> APIKey | None:
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_api_key(db: AsyncSession, api_key: APIKey, data: APIKeyUpdate) -> APIKey:
    if data.name is not None:
        api_key.name = data.name
    if data.is_active is not None:
        api_key.is_active = data.is_active
    await db.commit()
    await db.refresh(api_key)
    return api_key


async def delete_api_key(db: AsyncSession, api_key: APIKey) -> None:
    await db.delete(api_key)
    await db.commit()


async def validate_api_key(db: AsyncSession, raw_key: str) -> APIKey | None:
    result = await db.execute(select(APIKey).where(APIKey.is_active == True))
    for key in result.scalars().all():
        if verify_api_key(raw_key, key.key_hash):
            return key
    return None