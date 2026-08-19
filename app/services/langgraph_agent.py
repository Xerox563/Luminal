from __future__ import annotations

from typing import Any, Dict, List, Optional

from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage

from app.services.router import score_complexity_hybrid
from app.services.router import (
    get_model_for_complexity,
    get_default_model,
    route_request,
)
from app.services.rag import inject_context, needs_rag
from app.services.tool_calling import decide_tool_call, decide_tool_call_llm, ToolCallDecision
from app.services.tool_execution import process_tool_calls, format_tool_results
from app.services.openrouter import call_openrouter, calculate_cost
from app.services.budget import get_budget_status
from app.services.cache import generate_cache_key, get_cached_response, set_cached_response
from app.core.config import settings
from app.models import ComplexityLevel as ComplexityLevelModel, ExecutionLog, User
from app.db.session import get_db, engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


class LuminalState(Dict[str, Any]):
    """State for the Luminal LangGraph agent."""

    prompt: str
    user_id: int
    complexity: ComplexityLevel
    model_config: Optional[dict] = None
    messages: List[BaseMessage] = []
    rag_result: Optional[dict] = None
    tool_result: Optional[dict] = None
    response: Optional[str] = None
    error: Optional[str] = None
    budget_status: Optional[dict] = None
    tokens_used: int = 0
    cost: float = 0.0
    latency_ms: int = 0
    retrieval_metadata: Optional[dict] = None
    tool_metadata: Optional[dict] = None
    iteration_count: int = 0
    max_iterations: int = 5
    session_id: str = ""


def analyze_node(state: LuminalState) -> LuminalState:
    """Analyze the prompt to determine complexity and whether RAG/tools are needed."""
    prompt = state["prompt"]
    user_id = state["user_id"]

    # Score complexity using hybrid approach
    complexity = score_complexity_hybrid(prompt)

    # Check if RAG is needed
    rag_needed = needs_rag(prompt)

    return {
        **state,
        "complexity": complexity,
        "iteration_count": state.get("iteration_count", 0) + 1,
    }


def retrieve_node(state: LuminalState) -> LuminalState:
    """Retrieve relevant context from knowledge base if RAG is needed."""
    prompt = state["prompt"]
    user_id = state["user_id"]
    budget_status = state.get("budget_status", {})

    # If budget is over 95%, skip RAG
    if budget_status.get("percent_used", 0) >= 95:
        from app.services.rag import RAGResult

        state["rag_result"] = RAGResult(
            augmented_prompt=prompt,
            retrieved_chunks=[],
            citations=[],
            used_rag=False,
            citation_text=""
        )
        return {**state, "rag_result": state["rag_result"]}

    # Inject RAG context
    rag_result = inject_context(prompt, user_id)
    return {**state, "rag_result": rag_result}


def tool_node(state: LuminalState) -> LuminalState:
    """Process tool calls if needed."""
    prompt = state["prompt"]
    use_llm = settings.use_llm_complexity

    # Decide if tool should be called (heuristic approach)
    decision = decide_tool_call(prompt) if not use_llm else None

    # If LLM mode, use decide_tool_call_llm
    if use_llm:
        from langchain_core.callbacks import CallbackManagerForToolCall

        decision = decide_tool_call_llm(prompt)

    if decision and decision.should_call:
        # Execute the tool
        tool_results = process_tool_calls(prompt, use_llm=use_llm)
        formatted = format_tool_results(tool_results)
        return {**state, "tool_result": {"decision": decision, "formatted": formatted}}
    else:
        return {**state, "tool_result": {"decision": decision, "formatted": ""}}


def route_node(state: LuminalState) -> LuminalState:
    """Select the appropriate model based on complexity and budget."""
    prompt = state["prompt"]
    user_id = state["user_id"]
    complexity = state["complexity"]
    budget_status = state.get("budget_status", {})

    # If budget is severely exceeded, use cheapest model
    if budget_status.get("is_over_budget", False):
        from app.services.router import get_cheapest_model
        from sqlalchemy.ext.asyncio import AsyncSession
        from sqlalchemy import select

        # We'll handle this asynchronously
        return {
            **state,
            "model_config": {},
            "error": "Budget exceeded - model selection deferred",
        }

    # Get model for complexity (async, will be handled in graph runner)
    # For now, return empty - the actual routing happens in the async runner
    return {
        **state,
        "model_config": {},
    }


async def generate_node(state: LuminalState) -> LuminalState:
    """Generate the response using the selected model."""
    prompt = state["prompt"]
    user_id = state["user_id"]
    model_config = state.get("model_config", {})
    rag_result = state.get("rag_result", {})
    tool_result = state.get("tool_result", {})

    if not model_config:
        return {**state, "error": "No model configuration available"}

    model_name = model_config.get("model_name", "")
    provider = model_config.get("provider", "openrouter")
    temperature = float(model_config.get("temperature", 0.7))
    max_tokens = int(model_config.get("max_tokens", 4096))

    # Build the augmented prompt with RAG context if needed
    augmented_prompt = prompt
    if rag_result.get("used_rag"):
        citation_text = rag_result.get("citation_text", "")
        context = rag_result.get("augmented_prompt", prompt)
        augmented_prompt = context

    # Add tool context if available
    tool_context = ""
    if tool_result.get("formatted"):
        tool_context = tool_result["formatted"]

    # Prepare messages
    messages = state.get("messages", [])
    if not messages:
        messages = [HumanMessage(content=prompt)]

    messages_dict = [{"role": "user", "content": augmented_prompt}]
    if tool_context:
        messages_dict[0]["content"] = augmented_prompt + tool_context

    try:
        result = await call_openrouter(
            model=model_name,
            messages=messages_dict,
            max_tokens=max_tokens,
            temperature=temperature,
        )

        response_content = result.get("content", "")
        prompt_tokens = result.get("prompt_tokens", 0)
        completion_tokens = result.get("completion_tokens", 0)
        total_tokens = result.get("total_tokens", 0)
        latency_ms = result.get("latency_ms", 0)
        cost = calculate_cost(model_name, prompt_tokens, completion_tokens)

        # Update retrieval/tool metadata
        final_metadata = {**state.get("retrieval_metadata", {}), **{"used_rag": rag_result.get("used_rag", False)}}
        if tool_result.get("decision"):
            final_metadata = {
                **final_metadata,
                **{"tool_calls": [
                    {"tool": tool_result["decision"].tool_name,
                     "success": tool_result["decision"].should_call,
                     "result": None,
                     "error": None}
                ]}
            }

        return {
            **state,
            "response": response_content,
            "tokens_used": total_tokens,
            "cost": cost,
            "latency_ms": latency_ms,
            "retrieval_metadata": final_metadata,
            "tool_metadata": tool_result,
        }
    except Exception as e:
        return {**state, "error": str(e)}


def should_continue(state: LuminalState) -> str:
    """Determine the next step based on current state."""
    # If error, end
    if state.get("error"):
        return END

    # If over max iterations, end
    if state.get("iteration_count", 0) >= state.get("max_iterations", 5):
        return END

    # If no response yet, continue to generate
    if not state.get("response"):
        return "generate"

    # Otherwise, end
    return END


def langgraph_agent_graph(user_id: int) -> StateGraph:
    """Create the LangGraph agent workflow for a user."""
    workflow = StateGraph(LuminalState)

    # Add nodes
    workflow.add_node("analyze", analyze_node)
    workflow.add_node("retrieve", retrieve_node)
    workflow.add_node("tool", tool_node)
    workflow.add_node("route", route_node)
    workflow.add_node("generate", generate_node)

    # Add edges
    workflow.set_entry_point("analyze")

    workflow.add_edge("analyze", "retrieve")
    workflow.add_edge("retrieve", "tool")
    workflow.add_edge("tool", "route")
    workflow.add_edge("route", "generate")

    # Conditional edge from generate
    workflow.add_conditional_edges(
        "generate",
        should_continue,
        {
            END: END,
        },
    )

    return workflow


async def save_conversation_log(
    db: AsyncSession,
    user_id: int,
    prompt: str,
    response: str,
    model_used: str,
    complexity: ComplexityLevel,
    tokens_used: int,
    cost: float,
    latency_ms: int,
    error: Optional[str] = None,
) -> ExecutionLog:
    """Save conversation execution log to database."""
    from app.models import ExecutionLog
    
    log = ExecutionLog(
        user_id=user_id,
        prompt=prompt,
        model_used=model_used,
        provider="openrouter",
        complexity=complexity,
        prompt_tokens=0,
        completion_tokens=tokens_used,
        total_tokens=tokens_used,
        cost=cost,
        latency_ms=latency_ms,
        error_message=error,
        retrieval_metadata=None,
        tool_metadata=None,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


async def load_conversation_history(
    db: AsyncSession,
    user_id: int,
    limit: int = 10,
) -> List[BaseMessage]:
    """Load conversation history from database for a user."""
    from app.models import ExecutionLog
    
    result = await db.execute(
        select(ExecutionLog)
        .where(ExecutionLog.user_id == user_id)
        .order_by(ExecutionLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    
    messages = []
    for log in reversed(logs):
        if log.prompt:
            messages.append(HumanMessage(content=log.prompt))
        if log.response and hasattr(log, 'response') and log.response:
            messages.append(AIMessage(content=log.response))
    
    return messages


async def run_luminal_agent(
    prompt: str,
    user_id: int,
) -> Dict[str, Any]:
    """Run the LangGraph agent for a user prompt."""
    from sqlalchemy.ext.asyncio import AsyncSession as Session

    # Get user's model configs from database
    async with Session(engine) as db:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

    if not user:
        return {"error": f"User {user_id} not found"}

    # Compile the graph
    graph = langgraph_agent_graph(user_id)

    # Initial state
    initial_state: LuminalState = {
        "prompt": prompt,
        "user_id": user_id,
        "complexity": ComplexityLevel.LOW,
        "messages": [HumanMessage(content=prompt)],
        "max_iterations": 5,
        "iteration_count": 0,
    }

    # Run the graph
    final_state = await graph.ainvoke(
        initial_state,
        config={"configurable": {"thread_id": f"user_{user_id}"}},
    )

    return {
        "response": final_state.get("response"),
        "cost": final_state.get("cost", 0),
        "latency_ms": final_state.get("latency_ms", 0),
        "tokens_used": final_state.get("tokens_used", 0),
        "complexity": final_state.get("complexity"),
        "error": final_state.get("error"),
        "model_used": final_state.get("model_config", {}).get("model_name"),
    }