import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime
from app.models import ExecutionLog, ComplexityLevel
from app.services.openrouter import calculate_cost


def test_calculate_cost_known_model():
    cost = calculate_cost("openai/gpt-4o-mini", 1000, 500)
    expected = (1000 / 1_000_000) * 0.15 + (500 / 1_000_000) * 0.6
    assert abs(cost - expected) < 0.00001


def test_calculate_cost_unknown_model():
    cost = calculate_cost("unknown-model", 1000, 500)
    expected = (1000 / 1_000_000) * 1.0 + (500 / 1_000_000) * 2.0
    assert abs(cost - expected) < 0.00001


@pytest.mark.asyncio
async def test_execution_log_creation():
    log = ExecutionLog(
        user_id=1,
        prompt="Test prompt",
        model_used="openai/gpt-4o-mini",
        provider="openrouter",
        complexity=ComplexityLevel.LOW,
        prompt_tokens=100,
        completion_tokens=50,
        total_tokens=150,
        cost=0.0001,
        latency_ms=500
    )
    
    assert log.user_id == 1
    assert log.prompt == "Test prompt"
    assert log.model_used == "openai/gpt-4o-mini"
    assert log.complexity == ComplexityLevel.LOW
    assert log.total_tokens == 150
    assert log.cost == 0.0001
    assert log.latency_ms == 500
    assert log.error_message is None


@pytest.mark.asyncio
async def test_execution_log_with_error():
    log = ExecutionLog(
        user_id=1,
        prompt="Test prompt",
        model_used="openai/gpt-4o-mini",
        provider="openrouter",
        error_message="Rate limit exceeded",
        prompt_tokens=0,
        completion_tokens=0,
        total_tokens=0,
        cost=0,
        latency_ms=0
    )
    
    assert log.error_message == "Rate limit exceeded"
    assert log.total_tokens == 0
    assert log.cost == 0