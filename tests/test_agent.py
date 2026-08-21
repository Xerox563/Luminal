import pytest
from unittest.mock import AsyncMock, patch
from app.services.agent.state import AgentState, Message
from app.services.agent.nodes import (
    tool_node,
    should_continue_to_critic,
    should_continue_after_critic,
    should_handle_error,
    should_continue_to_approval,
    should_continue_after_approval,
)


def make_state(**overrides) -> AgentState:
    defaults = dict(session_id="user_1_test", user_id=1, current_prompt="hello")
    defaults.update(overrides)
    return AgentState(**defaults)


def test_critic_loop_is_bounded():
    state = make_state(should_regenerate=True, regeneration_count=2, max_regenerations=2)
    assert should_continue_to_critic(state) == "end"


def test_critic_continues_under_bound():
    state = make_state(should_regenerate=True, regeneration_count=0, max_regenerations=2)
    assert should_continue_to_critic(state) == "critic"


def test_critic_regeneration_trims_stale_assistant_message_not_context():
    state = make_state(
        should_regenerate=True,
        messages=[
            Message(role="system", content="RAG context"),
            Message(role="assistant", content="a bad answer"),
        ],
    )
    result = should_continue_after_critic(state)
    assert result == "generate"
    assert len(state.messages) == 1
    assert state.messages[0].role == "system"


def test_critic_accept_ends_without_trimming_messages():
    state = make_state(
        should_regenerate=False,
        messages=[Message(role="system", content="RAG context"), Message(role="assistant", content="ok")],
    )
    assert should_continue_after_critic(state) == "end"
    assert len(state.messages) == 2


def test_error_recovery_loop_is_bounded():
    state = make_state(error="timeout", error_count=3, max_errors=3)
    assert should_handle_error(state) == "end"


def test_error_recovery_continues_under_bound():
    state = make_state(error="timeout", error_count=1, max_errors=3)
    assert should_handle_error(state) == "error_recovery"


def test_error_recovery_skipped_without_error():
    state = make_state(error=None)
    assert should_handle_error(state) == "end"


def test_approval_gate_pauses_when_required():
    state = make_state(approval_required=True)
    assert should_continue_to_approval(state) == "approval"


def test_approval_gate_skipped_when_not_required():
    state = make_state(approval_required=False)
    assert should_continue_to_approval(state) == "route"


def test_approval_continues_after_grant():
    state = make_state(approval_required=True, approval_granted=True)
    assert should_continue_after_approval(state) == "route"


def test_approval_stops_while_pending():
    state = make_state(approval_required=True, approval_granted=None)
    assert should_continue_after_approval(state) == "end"


def test_approval_stops_when_denied():
    state = make_state(approval_required=True, approval_granted=False, error="User denied approval")
    assert should_continue_after_approval(state) == "end"


class _DummyDbCtx:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


@pytest.mark.asyncio
async def test_tool_node_pauses_for_approval_required_tool():
    from app.services.tool_calling import ToolCallDecision
    from app.models import MCPToolConfig

    decision = ToolCallDecision(
        should_call=True, tool_name="send_refund", arguments={"amount": 10}, confidence=0.9, reasoning="x"
    )
    tool = MCPToolConfig(id=1, user_id=1, name="send_refund", requires_approval=True, is_active=True)
    state = make_state()

    with patch("app.db.session.async_session_maker", return_value=_DummyDbCtx()), \
         patch("app.services.agent.nodes.decide_tool_call", new=AsyncMock(return_value=decision)), \
         patch("app.services.agent.nodes.get_mcp_tool_by_name", new=AsyncMock(return_value=tool)), \
         patch("app.services.agent.nodes.execute_tool_call", new=AsyncMock()) as mock_execute:
        result = await tool_node(state)

    assert result.approval_required is True
    assert result.pending_approval == {"tool": "send_refund", "arguments": {"amount": 10}}
    mock_execute.assert_not_called()


@pytest.mark.asyncio
async def test_tool_node_executes_once_already_approved():
    from app.services.tool_calling import ToolCallDecision
    from app.services.tool_execution import ToolExecutionResult
    from app.models import MCPToolConfig

    decision = ToolCallDecision(
        should_call=True, tool_name="send_refund", arguments={"amount": 10}, confidence=0.9, reasoning="x"
    )
    tool = MCPToolConfig(id=1, user_id=1, name="send_refund", requires_approval=True, is_active=True)
    exec_result = ToolExecutionResult(tool_name="send_refund", success=True, result={"ok": True}, arguments={"amount": 10})
    state = make_state(
        approval_granted=True,
        pending_approval={"tool": "send_refund", "arguments": {"amount": 10}},
    )

    with patch("app.db.session.async_session_maker", return_value=_DummyDbCtx()), \
         patch("app.services.agent.nodes.decide_tool_call", new=AsyncMock(return_value=decision)), \
         patch("app.services.agent.nodes.get_mcp_tool_by_name", new=AsyncMock(return_value=tool)), \
         patch("app.services.agent.nodes.execute_tool_call", new=AsyncMock(return_value=exec_result)):
        result = await tool_node(state)

    assert result.approval_required is False
    assert result.pending_approval is None
    assert result.tools_used == ["send_refund"]
