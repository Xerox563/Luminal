import asyncio
from typing import Dict, Any, Optional
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

allowed_msgpack_modules = [
    ("app.services.agent.state", "Message"),
    ("app.models", "ComplexityLevel"),
]
from app.services.agent.state import AgentState, Message
from app.services.agent.nodes import (
    analyze_node, retrieve_node, tool_node, route_node,
    generate_node, critic_node, approval_node, error_recovery_node,
    should_continue_to_tool, should_continue_to_critic,
    should_continue_after_critic, should_handle_error,
    should_continue_to_approval, should_continue_after_approval
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

# A tool marked requires_approval pauses the run here (approval_required=True)
# instead of continuing to route/generate; POST /route/approve + resume_agent()
# grants/denies and resumes from this point.
workflow.add_conditional_edges("tool", should_continue_to_approval, {"approval": "approval", "route": "route"})
workflow.add_conditional_edges("approval", should_continue_after_approval, {"route": "route", "end": END})

workflow.add_edge("route", "generate")

workflow.add_conditional_edges("generate", should_handle_error, {"error_recovery": "error_recovery", "end": "critic"})
workflow.add_edge("error_recovery", "generate")

workflow.add_conditional_edges("critic", should_continue_after_critic, {"generate": "generate", "end": END})

memory = MemorySaver().with_allowlist(allowed_msgpack_modules)
app = workflow.compile(checkpointer=memory)

AGENT_TIMEOUT = 60


async def run_agent(
    session_id: str,
    user_id: int,
    prompt: str,
    config: Optional[Dict] = None
) -> Dict[str, Any]:
    from datetime import datetime

    # If this session_id was used before, carry its conversation history
    # forward so the new turn continues the same conversation.
    prior_messages = []
    prior_state = await get_agent_state(session_id)
    if prior_state and prior_state.get("messages"):
        for m in prior_state["messages"]:
            if isinstance(m, Message):
                prior_messages.append(m)
            elif isinstance(m, dict):
                try:
                    prior_messages.append(Message(**m))
                except Exception:
                    pass

    initial_state = AgentState(
        session_id=session_id,
        user_id=user_id,
        current_prompt=prompt,
        messages=prior_messages
    )

    thread_config = {"configurable": {"thread_id": session_id}}
    if config:
        thread_config.update(config)

    completed_at = datetime.utcnow()
    
    def to_dict(o: Any) -> Dict[str, Any]:
        if hasattr(o, "to_dict"):
            return o.to_dict()
        if isinstance(o, dict):
            return dict(o)
        return {k: getattr(o, k) for k in o.__dataclass_fields__.keys()}
    
    try:
        result_raw = await asyncio.wait_for(
            app.ainvoke(initial_state, config=thread_config),
            timeout=AGENT_TIMEOUT
        )
        result = to_dict(result_raw)
        result["completed_at"] = completed_at.isoformat()
        
        try:
            await app.aupdate_state(thread_config, {"completed_at": completed_at})
        except Exception:
            pass
    except asyncio.TimeoutError:
        result = to_dict(initial_state)
        result["error"] = "Request timed out. Check your API key and try again."
        result["completed_at"] = completed_at.isoformat()
        try:
            await app.aupdate_state(thread_config, {
                "completed_at": completed_at,
                "error": result["error"],
                "trace": initial_state.trace,
            })
        except Exception:
            pass
    except Exception as e:
        result = to_dict(initial_state)
        result["error"] = str(e)
        result["completed_at"] = completed_at.isoformat()
        try:
            await app.aupdate_state(thread_config, {
                "completed_at": completed_at,
                "error": result["error"],
                "trace": initial_state.trace,
            })
        except Exception:
            pass
    
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


async def get_agent_state(session_id: str) -> Optional[Dict[str, Any]]:
    thread_config = {"configurable": {"thread_id": session_id}}
    try:
        state = await app.aget_state(thread_config)
        if not state or not state.values:
            return None
        vals = state.values
        if isinstance(vals, dict):
            return vals
        if hasattr(vals, "to_dict"):
            return vals.to_dict()
        return {k: getattr(vals, k) for k in vals.__dataclass_fields__.keys()}
    except Exception:
        return None


async def resume_agent(session_id: str, approval_granted: bool) -> Optional[Dict[str, Any]]:
    from datetime import datetime
    thread_config = {"configurable": {"thread_id": session_id}}
    state = await app.aget_state(thread_config)
    if not state or not state.values:
        return None
    vals = state.values
    is_dict = isinstance(vals, dict)
    completed_at = datetime.utcnow()

    if not approval_granted:
        # Denied: don't re-run the pipeline (it would just hit the same
        # pending tool again) — just record the denial and stop here.
        if is_dict:
            vals["approval_granted"] = False
            vals["approval_required"] = False
            vals["error"] = "User denied approval"
            vals["completed_at"] = completed_at
        else:
            vals.approval_granted = False
            vals.approval_required = False
            vals.error = "User denied approval"
            vals.completed_at = completed_at
        await app.aupdate_state(thread_config, vals if is_dict else vals.to_dict())
        result = vals if is_dict else vals.to_dict()
        result["completed_at"] = completed_at.isoformat()
        return result

    if is_dict:
        vals["approval_granted"] = True
        vals["approval_required"] = False
    else:
        vals.approval_granted = True
        vals.approval_required = False
    result = await app.ainvoke(vals, config=thread_config)
    if isinstance(result, dict):
        result["completed_at"] = completed_at.isoformat()
        return result
    if hasattr(result, "to_dict"):
        d = result.to_dict()
        d["completed_at"] = completed_at.isoformat()
        return d
    return {k: getattr(result, k) for k in result.__dataclass_fields__.keys()}