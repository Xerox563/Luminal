from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models import ComplexityLevel, ModelConfig, User
from app.schemas.auth import AuthLoginRequest, AuthRegisterRequest, AuthSessionResponse
from app.schemas.user import UserCreate, UserResponse, Token
from app.schemas.api_key import APIKeyCreate, APIKeyResponse, APIKeyUpdate
from app.services.auth import (
    create_access_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.services.api_key import (
    create_api_key,
    delete_api_key,
    get_api_key_by_id,
    get_api_keys,
    update_api_key,
    validate_api_key,
)
from typing import Annotated

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

DEFAULT_MODEL_CONFIGS = [
    {"complexity": "low", "model_name": "mistral:latest", "provider": "ollama", "is_default": True},
    {"complexity": "medium", "model_name": "llama3.2:latest", "provider": "ollama"},
    {"complexity": "high", "model_name": "codellama:latest", "provider": "ollama"},
]


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == normalize_email(email)))
    return result.scalar_one_or_none()


async def create_user_with_defaults(db: AsyncSession, user_data: UserCreate) -> User:
    existing_user = await get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=normalize_email(user_data.email),
        hashed_password=get_password_hash(user_data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    for config in DEFAULT_MODEL_CONFIGS:
        db.add(
            ModelConfig(
                user_id=user.id,
                complexity=ComplexityLevel(config["complexity"]),
                model_name=config["model_name"],
                provider=config["provider"],
                is_default=config.get("is_default", False),
            )
        )
    await db.commit()

    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


def build_auth_session(user: User) -> AuthSessionResponse:
    access_token = create_access_token(data={"sub": user.id})
    return AuthSessionResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


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
        payload = decode_token(token)
        subject = payload.get("sub")
        if subject is None:
            raise credentials_exception
        user_id = int(subject)
    except Exception:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


async def get_current_user_from_api_key(
    api_key: str,
    db: Annotated[AsyncSession, Depends(get_db)]
) -> User:
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


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    user = await create_user_with_defaults(db, user_data)
    return user


@router.post("/login", response_model=Token)
async def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: Annotated[AsyncSession, Depends(get_db)]):
    user = await authenticate_user(db, form_data.username, form_data.password)
    return build_auth_session(user)


@router.post("/session/register", response_model=AuthSessionResponse, status_code=status.HTTP_201_CREATED)
async def register_with_session(
    user_data: AuthRegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await create_user_with_defaults(db, user_data)
    return build_auth_session(user)


@router.post("/session/login", response_model=AuthSessionResponse)
async def login_with_session(
    credentials: AuthLoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await authenticate_user(db, credentials.email, credentials.password)
    return build_auth_session(user)


@router.get("/me", response_model=UserResponse)
async def read_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user


api_key_router = APIRouter(prefix="/api-keys", tags=["api-keys"])


@api_key_router.post("", response_model=APIKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_key(
    key_data: APIKeyCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    raw_key, api_key = await create_api_key(db, current_user.id, key_data.name)
    return APIKeyResponse(
        id=api_key.id,
        key=raw_key,
        name=api_key.name,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at
    )


@api_key_router.get("", response_model=list[APIKeyResponse])
async def list_keys(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    keys = await get_api_keys(db, current_user.id)
    return [
        APIKeyResponse(
            id=k.id,
            key="****" + k.key_hash[-8:] if k.key_hash else "****",
            name=k.name,
            is_active=k.is_active,
            created_at=k.created_at,
            expires_at=k.expires_at
        )
        for k in keys
    ]


@api_key_router.get("/{key_id}", response_model=APIKeyResponse)
async def get_key(
    key_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    api_key = await get_api_key_by_id(db, current_user.id, key_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    return APIKeyResponse(
        id=api_key.id,
        key="****" + api_key.key_hash[-8:] if api_key.key_hash else "****",
        name=api_key.name,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at
    )


@api_key_router.patch("/{key_id}", response_model=APIKeyResponse)
async def update_key(
    key_id: int,
    key_data: APIKeyUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    api_key = await get_api_key_by_id(db, current_user.id, key_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    api_key = await update_api_key(db, api_key, key_data)
    return APIKeyResponse(
        id=api_key.id,
        key="****" + api_key.key_hash[-8:] if api_key.key_hash else "****",
        name=api_key.name,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at
    )


@api_key_router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_key(
    key_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    api_key = await get_api_key_by_id(db, current_user.id, key_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    await delete_api_key(db, api_key)
