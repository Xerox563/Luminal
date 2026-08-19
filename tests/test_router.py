import pytest
from unittest.mock import AsyncMock, MagicMock
from app.models import ModelConfig, ComplexityLevel, User
from app.services.router import get_model_for_complexity, get_default_model, route_request


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def sample_user():
    user = User(id=1, email="test@example.com", hashed_password="hash")
    return user


@pytest.fixture
def model_configs():
    return [
        ModelConfig(id=1, user_id=1, complexity=ComplexityLevel.LOW, model_name="model-low", provider="openrouter", is_default=True),
        ModelConfig(id=2, user_id=1, complexity=ComplexityLevel.MEDIUM, model_name="model-medium", provider="openrouter"),
        ModelConfig(id=3, user_id=1, complexity=ComplexityLevel.HIGH, model_name="model-high", provider="openrouter"),
    ]


@pytest.mark.asyncio
async def test_get_model_for_complexity_found(mock_db, model_configs):
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = model_configs[0]
    mock_db.execute.return_value = mock_result

    result = await get_model_for_complexity(mock_db, 1, ComplexityLevel.LOW)
    assert result == model_configs[0]


@pytest.mark.asyncio
async def test_get_model_for_complexity_not_found(mock_db):
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    result = await get_model_for_complexity(mock_db, 1, ComplexityLevel.LOW)
    assert result is None


@pytest.mark.asyncio
async def test_get_default_model_found(mock_db, model_configs):
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = model_configs[0]
    mock_db.execute.return_value = mock_result

    result = await get_default_model(mock_db, 1)
    assert result == model_configs[0]


@pytest.mark.asyncio
async def test_get_default_model_fallback(mock_db, model_configs):
    mock_result1 = MagicMock()
    mock_result1.scalar_one_or_none.return_value = None
    mock_result2 = MagicMock()
    mock_result2.scalar_one_or_none.return_value = model_configs[1]
    mock_db.execute.side_effect = [mock_result1, mock_result2]

    result = await get_default_model(mock_db, 1)
    assert result == model_configs[1]