from typing import Dict, Any, Literal
from langgraph.graph import StateGraph
from app.services.agent.state import AgentState, Message
from app.services.router import route_request
from app.services.rag import inject_context
from app.services.tool_calling import decide_tool_call, decide_tool_call_llm
from app.services.tool_execution import execute_tool_call, format_tool_results
from app.services.mcp_tool import get_mcp_tool_by_name
from app.services.mcp import get_mcp_client
from app.services.providers import ProviderRegistry
from app.services.cache import generate_cache_key, get_cached_response, set_cached_response
from app.services.retry import retry_with_backoff
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
import json


async def analyze_node(state: AgentState) -> AgentState:
    state.add_trace("analyze", "start", {"prompt": state.current_prompt})

    from app.services.router import score_complexity_hybrid
    state.complexity = await score_complexity_hybrid(state.current_prompt)

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

    from app.db.session import async_session_maker
    async with async_session_maker() as db:
        if settings.use_llm_complexity:
            decision = await decide_tool_call_llm(db, state.user_id, state.current_prompt)
        else:
            decision = await decide_tool_call(db, state.user_id, state.current_prompt)

        if not decision.should_call:
            state.add_trace("tool", "complete", {"tools_used": [], "results": 0})
            return state

        tool = await get_mcp_tool_by_name(db, state.user_id, decision.tool_name)

        already_approved = (
            state.approval_granted is True
            and state.pending_approval is not None
            and state.pending_approval.get("tool") == decision.tool_name
        )

        if tool and tool.requires_approval and not already_approved:
            state.approval_required = True
            state.pending_approval = {"tool": decision.tool_name, "arguments": decision.arguments}
            state.add_trace("tool", "awaiting_approval", {"tool": decision.tool_name, "arguments": decision.arguments})
            return state

        result = await execute_tool_call(db, state.user_id, decision)
        tool_results = [result]

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

    # Clear any approval that gated this tool call now that it has run.
    state.approval_required = False
    state.pending_approval = None

    state.add_trace("tool", "complete", {"tools_used": state.tools_used, "results": len(state.tool_results)})
    return state


async def route_node(state: AgentState) -> AgentState:
    state.add_trace("route", "start", {"complexity": state.complexity.value if state.complexity else None})
    
    from app.db.session import async_session_maker
    
    async with async_session_maker() as db:
        model_config, resolved_complexity = await route_request(
            db, state.user_id, state.current_prompt, complexity=state.complexity
        )
        state.complexity = resolved_complexity
        state.selected_model = model_config.model_name
        state.selected_provider = model_config.provider
        state.model_config = {
            "model_name": model_config.model_name,
            "provider": model_config.provider,
            "max_tokens": model_config.max_tokens,
            "temperature": float(model_config.temperature)
        }
    
    state.add_trace("route", "complete", {"model": state.selected_model, "provider": state.selected_provider})
    return state


async def generate_node(state: AgentState) -> AgentState:
    import time
    from app.services import runtime_settings

    start_time = time.time()

    default_provider = runtime_settings.get_setting("default_provider") or settings.default_provider or "ollama"

    if state.selected_provider and default_provider == "ollama" and state.selected_provider != "ollama":
        state.add_trace("generate", "override", {
            "reason": "default_provider=ollama forced",
            "from_provider": state.selected_provider,
            "from_model": state.selected_model,
            "to_provider": "ollama",
            "to_model": "mistral:latest",
        })
        state.selected_provider = "ollama"
        state.selected_model = "mistral:latest"
        state.model_config = {
            "model_name": "mistral:latest",
            "provider": "ollama",
            "max_tokens": state.model_config.get("max_tokens", 4096) if state.model_config else 4096,
            "temperature": state.model_config.get("temperature", 0.7) if state.model_config else 0.7,
        }

    state.add_trace("generate", "start", {
        "model": state.selected_model,
        "provider": state.selected_provider,
    })

    if not state.model_config:
        state.error = "No model configuration"
        state.add_trace("generate", "error", {"error": state.error})
        return state

    resolved_provider_name = state.selected_provider
    provider_obj = ProviderRegistry.get(state.selected_provider)
    if not provider_obj:
        provider_obj = ProviderRegistry.get_for_model(state.selected_model)
        if provider_obj:
            resolved_provider_name = provider_obj.name
    if not provider_obj:
        provider_obj = ProviderRegistry.get("ollama") or ProviderRegistry.get("openrouter")
        if provider_obj:
            resolved_provider_name = provider_obj.name

    if not provider_obj:
        state.error = "No provider available"
        state.add_trace("generate", "error", {"error": state.error})
        return state

    if resolved_provider_name != state.selected_provider:
        state.add_trace("generate", "provider_resolved", {
            "configured": state.selected_provider,
            "resolved": resolved_provider_name,
        })
        state.selected_provider = resolved_provider_name

    try:
        max_tokens = state.model_config.get("max_tokens", 4096)
        temperature = state.model_config.get("temperature", 0.7)
        cache_key = generate_cache_key(
            "\n".join(m.content for m in state.messages),
            state.selected_model,
            temperature,
            max_tokens,
        )

        result = None
        # Only serve from cache on the first attempt — a critic-triggered
        # regeneration must not just replay the same cached response.
        if state.regeneration_count == 0:
            result = await get_cached_response(cache_key)
            if result:
                state.add_trace("generate", "cache_hit", {"model": state.selected_model})

        if not result:
            result = await retry_with_backoff(
                provider_obj.chat_completion,
                model=state.selected_model,
                messages=[m.model_dump() for m in state.messages],
                max_tokens=max_tokens,
                temperature=temperature,
                max_retries=3,
            )
            await set_cached_response(cache_key, result)

        state.response = result["content"]
        state.messages.append(Message(role="assistant", content=state.response))

        prompt_tokens = result.get("prompt_tokens", 0)
        completion_tokens = result.get("completion_tokens", 0)
        total_tokens = result.get("total_tokens", prompt_tokens + completion_tokens)
        state.prompt_tokens = prompt_tokens
        state.completion_tokens = completion_tokens
        state.tokens_used = total_tokens

        cost = provider_obj.calculate_cost(state.selected_model, prompt_tokens, completion_tokens)
        state.cost = cost

        latency_ms = int((time.time() - start_time) * 1000)
        state.latency_ms = latency_ms

        state.add_trace("generate", "complete", {
            "tokens": total_tokens,
            "cost": cost,
            "latency_ms": latency_ms,
            "provider": state.selected_provider,
            "model": state.selected_model,
        })
    except Exception as e:
        err_str = str(e)
        is_payment_error = (
            "402" in err_str
            or "Payment Required" in err_str
            or "payment required" in err_str.lower()
        )
        is_auth_error = (
            "401" in err_str
            or "Unauthorized" in err_str
            or "authentication" in err_str.lower()
        )

        if is_payment_error:
            ollama = ProviderRegistry.get("ollama")
            if ollama and state.selected_provider != "ollama" and state.error_count == 0:
                state.add_trace("generate", "fallback", {"from": state.selected_provider, "to": "ollama"})
                state.selected_provider = "ollama"
                state.selected_model = "mistral:latest"
                state.model_config = {
                    "model_name": "mistral:latest",
                    "provider": "ollama",
                    "max_tokens": state.model_config.get("max_tokens", 4096),
                    "temperature": state.model_config.get("temperature", 0.7),
                }
                state.error_count += 1
                try:
                    fallback_start = time.time()
                    result = await ollama.chat_completion(
                        model="mistral:latest",
                        messages=[m.model_dump() for m in state.messages],
                        max_tokens=state.model_config.get("max_tokens", 4096),
                        temperature=state.model_config.get("temperature", 0.7)
                    )
                    state.response = result["content"]
                    state.messages.append(Message(role="assistant", content=state.response))
                    prompt_tokens = result.get("prompt_tokens", 0)
                    completion_tokens = result.get("completion_tokens", 0)
                    total_tokens = result.get("total_tokens", prompt_tokens + completion_tokens)
                    state.prompt_tokens = prompt_tokens
                    state.completion_tokens = completion_tokens
                    state.tokens_used = total_tokens
                    state.cost = 0.0
                    state.latency_ms = int((time.time() - fallback_start) * 1000)
                    state.error = None
                    state.add_trace("generate", "complete", {
                        "tokens": total_tokens,
                        "cost": 0.0,
                        "latency_ms": state.latency_ms,
                        "fallback": True
                    })
                    return state
                except Exception as fe:
                    err_str = (
                        f"Cloud provider returned 402 Payment Required (no credits / invalid billing). "
                        f"Tried to fall back to local Ollama but failed: {str(fe)}. "
                        f"Please either: (1) top up your OpenRouter account, "
                        f"(2) switch the default provider to Ollama in Settings, "
                        f"or (3) make sure Ollama is running locally with `ollama serve` and `ollama pull mistral`."
                    )
            else:
                err_str = (
                    f"402 Payment Required — your cloud provider (OpenRouter) returned a billing error. "
                    f"To fix this, you can either:\n"
                    f"  1. Switch to the toggle below and use a local Ollama model (free, no API key needed)\n"
                    f"  2. Add credits to your OpenRouter account at https://openrouter.ai/credits\n"
                    f"  3. Change your default provider in the Provider Settings section below"
                )
        elif is_auth_error:
            err_str = (
                f"Authentication error with provider {state.selected_provider}. "
                f"Please check your API key in Provider Settings. "
                f"Alternatively, switch to local Ollama mode (no key required)."
            )
        elif "ollama" in (state.selected_provider or "").lower():
            err_str = (
                f"Ollama error: {err_str}\n"
                f"Make sure Ollama is running locally: `ollama serve`\n"
                f"And you have pulled the model: `ollama pull {state.selected_model}`\n"
                f"Default Ollama URL: http://localhost:11434"
            )

        state.error = err_str
        state.error_count += 1
        state.add_trace("generate", "error", {"error": state.error})

    return state


async def critic_node(state: AgentState) -> AgentState:
    state.add_trace("critic", "start", {"regeneration_count": state.regeneration_count})

    if state.regeneration_count >= state.max_regenerations:
        state.should_regenerate = False
        state.add_trace("critic", "max_regenerations_reached")
        return state

    if not state.response or state.error:
        state.should_regenerate = False
        state.add_trace("critic", "skipped_no_response", {"error": state.error})
        return state

    is_local = (state.selected_provider or "").lower() == "ollama"

    if is_local:
        state.should_regenerate = False
        state.quality_score = 0.8
        state.critic_feedback = "Accepted (local mode — critic review skipped)"
        state.add_trace("critic", "accept_local_mode")
        return state

    provider_obj = (
        ProviderRegistry.get(state.selected_provider)
        or ProviderRegistry.get("openrouter")
        or ProviderRegistry.get("openai")
    )
    if not provider_obj:
        state.should_regenerate = False
        state.quality_score = 0.75
        state.add_trace("critic", "no_provider_for_critic")
        return state

    critic_model = state.selected_model if state.selected_provider != "openrouter" else "anthropic/claude-3-haiku"

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
            model=critic_model,
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
        state.quality_score = 0.7

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
    from app.services.tool_calling import needs_tool_call
    if needs_tool_call(state.current_prompt):
        return "tool"
    return "route"


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


def should_continue_to_approval(state: AgentState) -> Literal["approval", "route"]:
    if state.approval_required:
        return "approval"
    return "route"


def should_continue_after_approval(state: AgentState) -> Literal["route", "end"]:
    # Either denied (state.error set) or still waiting on a decision
    # (approval_granted is None) — both end this run here. A grant
    # resumes execution via resume_agent(), which re-enters the graph
    # with approval_granted=True and reaches this node again.
    if state.approval_granted is True and not state.error:
        return "route"
    return "end"