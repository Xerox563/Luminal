import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import ModelConfig, User
from app.services.auth import get_password_hash


@pytest_asyncio.fixture
async def auth_client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, session_maker

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_register_with_session_returns_jwt_and_default_models(auth_client):
    client, session_maker = auth_client

    response = await client.post(
        "/auth/session/register",
        json={"email": "NewUser@example.com", "password": "supersecure"},
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["access_token"]
    assert payload["token_type"] == "bearer"
    assert payload["user"]["email"] == "newuser@example.com"

    async with session_maker() as session:
        users = (await session.execute(select(User))).scalars().all()
        configs = (await session.execute(select(ModelConfig))).scalars().all()

    assert len(users) == 1
    assert len(configs) == 3
    assert sum(1 for config in configs if config.is_default) == 1


@pytest.mark.asyncio
async def test_simple_json_login_returns_jwt(auth_client):
    client, session_maker = auth_client

    async with session_maker() as session:
        session.add(
            User(
                email="signin@example.com",
                hashed_password=get_password_hash("supersecure"),
            )
        )
        await session.commit()

    response = await client.post(
        "/auth/session/login",
        json={"email": "signin@example.com", "password": "supersecure"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["access_token"]
    assert payload["user"]["email"] == "signin@example.com"


@pytest.mark.asyncio
async def test_legacy_form_login_still_returns_token(auth_client):
    client, session_maker = auth_client

    async with session_maker() as session:
        session.add(
            User(
                email="legacy@example.com",
                hashed_password=get_password_hash("supersecure"),
            )
        )
        await session.commit()

    response = await client.post(
        "/auth/login",
        data={"username": "legacy@example.com", "password": "supersecure"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["access_token"]
    assert payload["token_type"] == "bearer"
