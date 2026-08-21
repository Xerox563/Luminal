from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import ProviderKey, ProviderName, User
from app.services.auth import encrypt_provider_key, decrypt_provider_key
from typing import Optional, List


async def create_provider_key(
    db: AsyncSession,
    user_id: int,
    provider: ProviderName,
    api_key: str,
    base_url: Optional[str] = None
) -> ProviderKey:
    encrypted_key = encrypt_provider_key(api_key)
    
    result = await db.execute(
        select(ProviderKey).where(
            ProviderKey.user_id == user_id,
            ProviderKey.provider == provider
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        existing.encrypted_key = encrypted_key
        existing.base_url = base_url
        existing.is_active = True
        existing.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return existing
    
    provider_key = ProviderKey(
        user_id=user_id,
        provider=provider,
        encrypted_key=encrypted_key,
        base_url=base_url,
        is_active=True
    )
    db.add(provider_key)
    await db.commit()
    await db.refresh(provider_key)
    return provider_key


async def get_provider_key(db: AsyncSession, user_id: int, provider: ProviderName) -> Optional[ProviderKey]:
    result = await db.execute(
        select(ProviderKey).where(
            ProviderKey.user_id == user_id,
            ProviderKey.provider == provider,
            ProviderKey.is_active == True
        )
    )
    return result.scalar_one_or_none()


async def get_provider_key_decrypted(db: AsyncSession, user_id: int, provider: ProviderName) -> Optional[str]:
    provider_key = await get_provider_key(db, user_id, provider)
    if provider_key:
        return decrypt_provider_key(provider_key.encrypted_key)
    return None


async def get_all_provider_keys(db: AsyncSession, user_id: int) -> List[ProviderKey]:
    result = await db.execute(
        select(ProviderKey).where(
            ProviderKey.user_id == user_id,
            ProviderKey.is_active == True
        )
    )
    return result.scalars().all()


async def delete_provider_key(db: AsyncSession, user_id: int, provider: ProviderName) -> bool:
    result = await db.execute(
        select(ProviderKey).where(
            ProviderKey.user_id == user_id,
            ProviderKey.provider == provider
        )
    )
    provider_key = result.scalar_one_or_none()
    if provider_key:
        await db.delete(provider_key)
        await db.commit()
        return True
    return False


async def get_provider_base_url(db: AsyncSession, user_id: int, provider: ProviderName) -> Optional[str]:
    provider_key = await get_provider_key(db, user_id, provider)
    if provider_key:
        return provider_key.base_url
    return None


from datetime import datetime