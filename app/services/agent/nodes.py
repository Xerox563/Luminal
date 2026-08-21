from typing import Dict, Any, Literal
from langgraph.graph import StateGraph
from app.services.agent.state import AgentState, Message
from app.services.router import route_request
from app.services.rag import inject_context, format_response_with_citations
from app.services.tool_calling import decide_tool_call
from app.services.tool_execution import process_tool_calls, format_tool_results
from app.services.mcp import get_mcp_client
from app.services.providers import ProviderRegistry
from app.services.complexity import score_complexity
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
import json


async def analyze_node(state: AgentState) -> AgentState:
    state.add_trace("analyze", "start", {"prompt": state.current_prompt})
    
    state.complexity = score_complexity(state.current_prompt)
    
    state.add_trace("analyze", "complete", {"complexity": state.complexity.value})
    return state


async def retrieve_node(state: AgentState) -> AgentState:
    state.add_trace("retrieve", "start", {"prompt": state.current_prompt})
    
    from app.services.rag import inject_context
    rag_result = await inject_context(state.current_prompt, state.user_id)
    
    state.retrieved_chunks = rag_result.retrieved_chunks
    state.citations = rag_result.citations
    state.used_rag = rag_result.used_rag
    
    if rag_result.used_rag:
        state.messages.append(Message(role="system", content=rag_result.augmented_prompt))
    else:
        state.messages.append(Message(role="user", content=state.current_prompt))
    
    state.add_trace("retrieve", "complete", {"used_rag": state.used_rag, "chunks": len(state.retrieved_chunks)})
    return state


async def tool_node(state: AgentState) -> AgentState:
    state.add_trace("tool", "start", {"prompt": state.current_prompt})
    
    async for db in get_db():
        tool_results = await process_tool_calls(db, state.user_id, state.current_prompt, use_llm=settings.use_llm_complexity)
        break
    
    if tool_results:
        state.tool_results = [
            {"tool": r.tool_name, "success": r.success, "result": r.result, "error": r.error}
            for r in tool_results
        ]
        state.tools_used = [r.tool_name for r in tool_results if r.success]
        state.tool_calls = [{"tool": r.tool_name, "arguments": r.arguments} for r in tool_results]
        
        tool_context = format_tool_results(tool_results)
        if state.messages and state.messages[-1].role == "system":
            state.messages[-1].content += tool_context
        else:
            state.messages.append(Message(role="system", content=tool_context))
    
    state.add_trace("tool", "complete", {"tools_used": state.tools_used, "results": len(state.tool_results)})
    return state


async def route_node(state: AgentState) -> AgentState:
    state.add_trace("route", "start", {"complexity": state.complexity.value if state.complexity else None})
    
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.db.session import get_db
    
    async for db in get_db():
        model_config, _ = await route_request(db, state.user_id, state.current_prompt)
        state.selected_model = model_config.model_name
        state.selected_provider = model_config.provider
        state.model_config = {
            "model_name": model_config.model_name,
            "provider": model_config.provider,
            "max_tokens": model_config.max_tokens,
            "temperature": float(model_config.temperature)
        }
        break
    
    state.add_trace("route", "complete", {"model": state.selected_model, "provider": state.selected_provider})
    return state


async def generate_node(state: AgentState) -> AgentState:
    state.add_trace("generate", "start", {"model": state.selected_model})
    
    if not state.model_config:
        state.error = "No model configuration"
        state.add_trace("generate", "error", {"error": state.error})
        return state
    
    provider_obj = ProviderRegistry.get(state.selected_provider)
    if not provider_obj:
        provider_obj = ProviderRegistry.get_for_model(state.selected_model)
    if not provider_obj:
        provider_obj = ProviderRegistry.get("openrouter")
    
    if not provider_obj:
        state.error = "No provider available"
        state.add_trace("generate", "error", {"error": state.error})
        return state
    
    try:
        result = await provider_obj.chat_completion(
            model=state.selected_model,
            messages=[m.model_dump() for m in state.messages],
            max_tokens=state.model_config.get("max_tokens", 4096),
            temperature=state.model_config.get("temperature", 0.7)
        )
        
        state.response = result["content"]
        state.add_trace("generate", "complete", {"tokens": result.get("total_tokens", 0)})
    except Exception as e:
        state.error = str(e)
        state.error_count += 1
        state.add_trace("generate", "error", {"error": state.error})
    
    return state


async def critic_node(state: AgentState) -> AgentState:
    state.add_trace("critic", "start", {"regeneration_count": state.regeneration_count})
    
    if state.regeneration_count >= state.max_regenerations:
        state.should_regenerate = False
        state.add_trace("critic", "max_regenerations_reached")
        return state
    
    provider_obj = ProviderRegistry.get("openrouter") or ProviderRegistry.get("openai")
    if not provider_obj:
        state.should_regenerate = False
        state.add_trace("critic", "no_provider_for_critic")
        return state
    
    critic_prompt = f"""Rate the quality of this response from 0.0 to 1.0 and provide feedback.

User query: {state.current_prompt}
Response: {state.response}

Criteria:
- Accuracy: Does it correctly answer the question?
- Completeness: Does it address all parts of the query?
- Clarity: Is it well-structured and easy to understand?
- Relevance: Does it stay on topic?

Respond with JSON only:
{{
  "score": 0.0-1.0,
  "feedback": "specific feedback",
  "should_regenerate": true/false
}}"""
    
    try:
        result = await provider_obj.chat_completion(
            model="anthropic/claude-3-haiku",
            messages=[
                {"role": "system", "content": critic_prompt},
                {"role": "user", "content": "Rate this response"}
            ],
            max_tokens=200,
            temperature=0
        )
        
        import json
        critic_data = json.loads(result["content"])
        state.quality_score = critic_data.get("score", 0.5)
        state.critic_feedback = critic_data.get("feedback", "")
        state.should_regenerate = critic_data.get("should_regenerate", False) and state.quality_score < 0.7
        
        if state.should_regenerate:
            state.regeneration_count += 1
            state.add_trace("critic", "regenerate", {"score": state.quality_score, "count": state.regeneration_count})
        else:
            state.add_trace("critic", "accept", {"score": state.quality_score})
    except Exception as e:
        state.add_trace("critic", "error", {"error": str(e)})
        state.should_regenerate = False
    
    return state


async def approval_node(state: AgentState) -> AgentState:
    state.add_trace("approval", "start", {"pending": state.pending_approval})
    
    if not state.approval_required:
        state.add_trace("approval", "skipped")
        return state
    
    if state.approval_granted is None:
        state.add_trace("approval", "waiting")
        return state
    
    if not state.approval_granted:
        state.error = "User denied approval"
        state.add_trace("approval", "denied")
        return state
    
    state.add_trace("approval", "granted")
    return state


async def error_recovery_node(state: AgentState) -> AgentState:
    state.add_trace("error_recovery", "start", {"error": state.error, "count": state.error_count})
    
    if state.error_count >= state.max_errors:
        state.add_trace("error_recovery", "max_errors_reached")
        return state
    
    if state.error and "timeout" in state.error.lower():
        if state.model_config:
            state.model_config["temperature"] = 0.3
        state.add_trace("error_recovery", "reduced_temperature")
    elif state.error and "rate limit" in state.error.lower():
        state.add_trace("error_recovery", "rate_limit_wait")
    elif state.error and "context" in state.error.lower():
        state.used_rag = False
        state.retrieved_chunks = []
        state.citations = []
        state.add_trace("error_recovery", "disabled_rag")
    
    state.error = None
    state.add_trace("error_recovery", "retry")
    return state


def should_continue_to_tool(state: AgentState) -> Literal["tool", "route"]:
    return "tool"


def should_continue_to_critic(state: AgentState) -> Literal["critic", "end"]:
    if state.should_regenerate and state.regeneration_count < state.max_regenerations:
        return "critic"
    return "end"


def should_continue_after_critic(state: AgentState) -> Literal["generate", "end"]:
    if state.should_regenerate:
        state.messages = state.messages[:-1]
        return "generate"
    return "end"


def should_handle_error(state: AgentState) -> Literal["error_recovery", "end"]:
    if state.error and state.error_count < state.max_errors:
        return "error_recovery"
    return "end"


def should_request_approval(state: AgentState) -> Literal["approval", "generate"]:
    if state.approval_required:
        return "approval"
    return "generate"