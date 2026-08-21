import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from unittest.mock import AsyncMock, patch

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models import User, ModelConfig, ComplexityLevel
from app.services.auth import create_access_token, get_password_hash
from app.services.providers.base import ProviderRegistry
from app.services.cache import invalidate_cache


@pytest_asyncio.fixture
async def e2e_client():
    """A real FastAPI app, talking to an isolated in-memory DB, with the LLM
    provider mocked out — exercises the actual /route HTTP endpoint through
    the real LangGraph agent pipeline (not the legacy router.route_request
    helper the older unit tests mock directly)."""
    # Redis-backed LLM response cache (app/services/cache.py) is real and
    # process-wide — clear it so a previous test/run can't serve a cache hit
    # here and hide whether chat_completion was actually called.
    await invalidate_cache()

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    async with session_maker() as session:
        user = User(
            email="e2e@test.com",
            hashed_password=get_password_hash("pw"),
            monthly_budget=100,
            current_spend=0,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        session.add(ModelConfig(
            user_id=user.id,
            complexity=ComplexityLevel.LOW,
            model_name="mistral:latest",
            provider="ollama",
            is_default=True,
        ))
        await session.commit()
        user_id = user.id

    token = create_access_token({"sub": user_id})

    # A hand-rolled fake instead of AsyncMock(): AsyncMock makes every child
    # attribute async too, so a sync method like calculate_cost() would
    # silently return an un-awaited coroutine instead of a float.
    class FakeProvider:
        name = "ollama"

        def __init__(self):
            self.chat_completion = AsyncMock(return_value={
                "content": "Hi there!",
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15,
            })

        def calculate_cost(self, model, prompt_tokens, completion_tokens):
            return 0.0

    mock_provider = FakeProvider()

    ProviderRegistry._providers.clear()
    ProviderRegistry.register(mock_provider)

    transport = ASGITransport(app=app)
    with patch("app.db.session.async_session_maker", session_maker):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, user_id, token, mock_provider

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_route_endpoint_runs_full_agent_pipeline(e2e_client):
    client, user_id, token, mock_provider = e2e_client

    resp = await client.post(
        "/route",
        json={"prompt": "Say hi"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["content"] == "Hi there!"
    assert data["model"] == "mistral:latest"
    assert data["tokens_used"] == 15
    assert data["session_id"].startswith(f"user_{user_id}_")
    assert "citations" in data
    mock_provider.chat_completion.assert_awaited()


@pytest.mark.asyncio
async def test_route_endpoint_continues_conversation_with_session_id(e2e_client):
    client, user_id, token, mock_provider = e2e_client
    headers = {"Authorization": f"Bearer {token}"}

    first = await client.post("/route", json={"prompt": "Say hi"}, headers=headers)
    session_id = first.json()["session_id"]

    second = await client.post(
        "/route",
        json={"prompt": "Say hi again", "session_id": session_id},
        headers=headers,
    )

    assert second.status_code == 200, second.text
    assert second.json()["session_id"] == session_id
    # Second call's messages should include the first turn's history.
    second_call_messages = mock_provider.chat_completion.await_args.kwargs["messages"]
    assert any("Say hi" == m["content"] for m in second_call_messages)


@pytest.mark.asyncio
async def test_route_endpoint_rejects_foreign_session_id(e2e_client):
    client, user_id, token, mock_provider = e2e_client

    resp = await client.post(
        "/route",
        json={"prompt": "Say hi", "session_id": "user_9999_deadbeef0000"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    assert not resp.json()["session_id"].startswith("user_9999_")
