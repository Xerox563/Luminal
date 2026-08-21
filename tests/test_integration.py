import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import User, ModelConfig, ComplexityLevel, APIKey, ExecutionLog
from app.services.auth import hash_api_key, verify_api_key, create_access_token
from app.services.budget import get_budget_status, add_spend, update_budget
from app.services.cache import generate_cache_key, get_cached_response, set_cached_response
from app.services.rate_limit import check_rate_limit
from app.services.router import route_request
from app.services.providers.base import ProviderRegistry
from app.services.providers.openai import OpenAIProvider


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def sample_user():
    user = User(id=1, email="test@example.com", hashed_password="hash", monthly_budget=10.0, current_spend=0.0)
    return user


@pytest.fixture
def sample_model_configs():
    return [
        ModelConfig(id=1, user_id=1, complexity=ComplexityLevel.LOW, model_name="gpt-3.5-turbo", provider="openai", is_default=True),
        ModelConfig(id=2, user_id=1, complexity=ComplexityLevel.MEDIUM, model_name="gpt-4o-mini", provider="openai"),
        ModelConfig(id=3, user_id=1, complexity=ComplexityLevel.HIGH, model_name="gpt-4o", provider="openai"),
    ]


@pytest.mark.asyncio
async def test_multi_provider_routing(mock_db, sample_user, sample_model_configs):
    with patch('app.services.router.get_budget_status', return_value={"percent_used": 0, "is_over_budget": False}):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_model_configs[0]
        mock_db.execute.return_value = mock_result
        
        model_config, complexity = await route_request(mock_db, 1, "What is 2+2?")
        assert model_config.model_name == "gpt-3.5-turbo"
        assert complexity == ComplexityLevel.LOW
        
        mock_result.scalar_one_or_none.return_value = sample_model_configs[1]
        model_config, complexity = await route_request(mock_db, 1, "Explain quantum computing")
        assert model_config.model_name == "gpt-4o-mini"
        assert complexity == ComplexityLevel.MEDIUM


@pytest.mark.asyncio
async def test_budget_enforcement_over_budget(mock_db, sample_user):
    sample_user.monthly_budget = 10.0
    sample_user.current_spend = 15.0
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = sample_user
    mock_db.execute.return_value = mock_result
    
    budget_status = await get_budget_status(mock_db, 1)
    assert budget_status["is_over_budget"] is True


@pytest.mark.asyncio
async def test_budget_enforcement_under_budget(mock_db, sample_user):
    sample_user.monthly_budget = 10.0
    sample_user.current_spend = 5.0
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = sample_user
    mock_db.execute.return_value = mock_result
    
    budget_status = await get_budget_status(mock_db, 1)
    assert budget_status["is_over_budget"] is False
    assert budget_status["percent_used"] == 50.0


@pytest.mark.asyncio
async def test_budget_aware_routing_forces_cheaper(mock_db, sample_user, sample_model_configs):
    with patch('app.services.router.get_budget_status', return_value={"percent_used": 96, "is_over_budget": False}):
        mock_model_result = MagicMock()
        mock_model_result.scalar_one_or_none.return_value = sample_model_configs[0]
        mock_db.execute.return_value = mock_model_result
        
        model_config, complexity = await route_request(mock_db, 1, "Analyze complex problem")
        assert model_config.model_name == "gpt-3.5-turbo"


@pytest.mark.asyncio
async def test_add_spend_updates_current_spend(mock_db, sample_user):
    sample_user.current_spend = 0.0
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = sample_user
    mock_db.execute.return_value = mock_result
    
    user = await add_spend(mock_db, 1, 0.5)
    assert user.current_spend == 0.5


@pytest.mark.asyncio
async def test_cache_key_generation():
    key1 = generate_cache_key("test prompt", "gpt-4o", 0.7, 4096)
    key2 = generate_cache_key("test prompt", "gpt-4o", 0.7, 4096)
    key3 = generate_cache_key("different prompt", "gpt-4o", 0.7, 4096)
    
    assert key1 == key2
    assert key1 != key3
    assert key1.startswith("llm_cache:")


def _mock_redis_pipeline(zcard_result: int):
    # pipeline() and its queueing methods (zremrangebyscore/zcard/zadd/expire)
    # are sync in redis.asyncio — only execute() is a coroutine.
    mock_pipe = MagicMock()
    mock_pipe.execute = AsyncMock(return_value=[None, zcard_result, None, None])
    mock_client = MagicMock()
    mock_client.pipeline.return_value = mock_pipe
    return mock_client


@pytest.mark.asyncio
async def test_rate_limit_check():
    from app.services.rate_limit import check_rate_limit

    mock_client = _mock_redis_pipeline(zcard_result=0)  # no requests yet in the window

    with patch('app.services.rate_limit.get_redis', return_value=mock_client):
        allowed, used, limit = await check_rate_limit("rate_limit:test", limit=5, window=60)
        assert allowed is True
        assert used == 1
        assert limit == 5


@pytest.mark.asyncio
async def test_rate_limit_exceeded():
    from app.services.rate_limit import check_rate_limit

    mock_client = _mock_redis_pipeline(zcard_result=5)  # already at the limit

    with patch('app.services.rate_limit.get_redis', return_value=mock_client):
        allowed, used, limit = await check_rate_limit("rate_limit:test", limit=5, window=60)
        assert allowed is False
        assert used == 5
        assert limit == 5


@pytest.mark.asyncio
async def test_rate_limit_fails_open_when_redis_unavailable():
    from app.services.rate_limit import check_rate_limit

    with patch('app.services.rate_limit.get_redis', side_effect=Exception("connection refused")):
        allowed, used, limit = await check_rate_limit("rate_limit:test", limit=5, window=60)
        assert allowed is True


@pytest.mark.asyncio
async def test_provider_registry():
    ProviderRegistry._providers.clear()
    provider = OpenAIProvider()
    ProviderRegistry.register(provider)
    
    assert ProviderRegistry.get("openai") == provider
    assert ProviderRegistry.get_for_model("gpt-4o") == provider
    assert "openai" in ProviderRegistry.list_providers()


@pytest.mark.asyncio
async def test_api_key_hashing():
    raw_key = "lum_test123"
    hashed = hash_api_key(raw_key)
    assert verify_api_key(raw_key, hashed)
    assert not verify_api_key("wrong_key", hashed)


@pytest.mark.asyncio
async def test_jwt_token_creation():
    token = create_access_token({"sub": 1})
    assert isinstance(token, str)
    assert len(token) > 0