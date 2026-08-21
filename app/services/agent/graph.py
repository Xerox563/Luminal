import asyncio
from typing import Dict, Any, Optional
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from app.services.agent.state import AgentState
from app.services.agent.nodes import (
    analyze_node, retrieve_node, tool_node, route_node,
    generate_node, critic_node, approval_node, error_recovery_node,
    should_continue_to_tool, should_continue_to_critic,
    should_continue_after_critic, should_handle_error,
    should_request_approval
)
from app.core.config import settings


workflow = StateGraph(AgentState)

workflow.add_node("analyze", analyze_node)
workflow.add_node("retrieve", retrieve_node)
workflow.add_node("tool", tool_node)
workflow.add_node("route", route_node)
workflow.add_node("generate", generate_node)
workflow.add_node("critic", critic_node)
workflow.add_node("approval", approval_node)
workflow.add_node("error_recovery", error_recovery_node)

workflow.set_entry_point("analyze")

workflow.add_edge("analyze", "retrieve")
workflow.add_conditional_edges("retrieve", should_continue_to_tool, {"tool": "tool", "route": "route"})
workflow.add_edge("tool", "route")
workflow.add_edge("route", "generate")

workflow.add_conditional_edges("generate", should_handle_error, {"error_recovery": "error_recovery", "end": "critic"})
workflow.add_edge("error_recovery", "generate")

workflow.add_conditional_edges("critic", should_continue_after_critic, {"generate": "generate", "end": "approval"})
workflow.add_conditional_edges("approval", should_request_approval, {"approval": "approval", "generate": "generate", "end": END})

memory = MemorySaver()
app = workflow.compile(checkpointer=memory)

AGENT_TIMEOUT = 60


async def run_agent(
    session_id: str,
    user_id: int,
    prompt: str,
    config: Optional[Dict] = None
) -> AgentState:
    from datetime import datetime
    initial_state = AgentState(
        session_id=session_id,
        user_id=user_id,
        current_prompt=prompt
    )
    
    thread_config = {"configurable": {"thread_id": session_id}}
    if config:
        thread_config.update(config)
    
    try:
        result = await asyncio.wait_for(
            app.ainvoke(initial_state, config=thread_config),
            timeout=AGENT_TIMEOUT
        )
        result.completed_at = datetime.utcnow()
        await app.aupdate_state(thread_config, {"completed_at": result.completed_at})
    except asyncio.TimeoutError:
        initial_state.completed_at = datetime.utcnow()
        initial_state.error = "Request timed out. Check your API key and try again."
        try:
            await app.aupdate_state(thread_config, {
                "completed_at": initial_state.completed_at,
                "error": initial_state.error,
                "trace": initial_state.trace
            })
        except Exception:
            pass
        return initial_state
    except Exception as e:
        initial_state.completed_at = datetime.utcnow()
        initial_state.error = str(e)
        try:
            await app.aupdate_state(thread_config, {
                "completed_at": initial_state.completed_at,
                "error": initial_state.error,
                "trace": initial_state.trace
            })
        except Exception:
            pass
        return initial_state
    
    return result


async def run_agent_stream(
    session_id: str,
    user_id: int,
    prompt: str,
    config: Optional[Dict] = None
):
    initial_state = AgentState(
        session_id=session_id,
        user_id=user_id,
        current_prompt=prompt
    )
    
    thread_config = {"configurable": {"thread_id": session_id}}
    if config:
        thread_config.update(config)
    
    async for event in app.astream(initial_state, config=thread_config):
        yield event


async def get_agent_state(session_id: str) -> Optional[AgentState]:
    thread_config = {"configurable": {"thread_id": session_id}}
    try:
        state = await app.aget_state(thread_config)
        return state.values if state else None
    except Exception:
        return None


async def resume_agent(session_id: str, approval_granted: bool) -> AgentState:
    thread_config = {"configurable": {"thread_id": session_id}}
    state = await app.aget_state(thread_config)
    if state and state.values:
        state.values.approval_granted = approval_granted
        state.values.approval_required = False
        result = await app.ainvoke(state.values, config=thread_config)
        return result
    return None