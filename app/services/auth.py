from datetime import datetime, timedelta
from typing import Annotated
from jose import jwt
from passlib.context import CryptContext
import hashlib
import os
from cryptography.fernet import Fernet
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
from starlette import status
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.config import settings
from app.models import User

# Use SHA256 for simplicity (bcrypt has version issues)
def get_password_hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_encryption_key() -> bytes:
    """Get or create the encryption key for provider API keys."""
    key = settings.encryption_key
    if not key:
        # Generate a key from secret_key for deterministic encryption
        import base64
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest()).decode()
    if isinstance(key, str):
        key = key.encode()
    return key


def encrypt_provider_key(api_key: str) -> str:
    """Encrypt a provider API key."""
    key = get_encryption_key()
    f = Fernet(key)
    return f.encrypt(api_key.encode()).decode()


def decrypt_provider_key(encrypted_key: str) -> str:
    """Decrypt a provider API key."""
    key = get_encryption_key()
    f = Fernet(key)
    return f.decrypt(encrypted_key.encode()).decode()


async def get_current_user_from_api_key(
    api_key: str,
    db: AsyncSession
) -> User:
    from app.services.api_key import validate_api_key
    key_obj = await validate_api_key(db, api_key)
    if not key_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    result = await db.execute(select(User).where(User.id == key_obj.user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    return user


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        from jose import jwt
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    # python-jose requires "sub" to be a string
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def decode_token(token: str) -> dict:
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    return payload


def hash_api_key(api_key: str) -> str:
    # Use SHA256 for API keys to avoid bcrypt 72-byte limit
    return hashlib.sha256(api_key.encode()).hexdigest()


def verify_api_key(plain_key: str, hashed_key: str) -> bool:
    return hashlib.sha256(plain_key.encode()).hexdigest() == hashed_key