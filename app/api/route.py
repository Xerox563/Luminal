from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.services.auth import get_current_user_from_api_key, decode_token, settings
from app.services.router import route_request, score_complexity_hybrid
from app.services.budget import add_spend, get_budget_status, check_and_reset_budget
from app.services.rate_limit import check_rate_limit
from app.services.rag import inject_context
from app.services.tool_calling import decide_tool_call, decide_tool_call_llm
from app.services.tool_execution import execute_tool_call, format_tool_results
from app.services.mcp_tool import get_mcp_tool_by_name
from app.services.providers import ProviderRegistry
from app.services.agent.graph import run_agent, get_agent_state, resume_agent
from app.models import ExecutionLog, User
from app.schemas.route import RouteRequest, RouteResponse, ApprovalRequest
import asyncio
import json
import uuid
from typing import Optional
from typing_extensions import Annotated

router = APIRouter(prefix="/route", tags=["route"])

RATE_LIMIT_REQUESTS = 60
RATE_LIMIT_WINDOW = 60


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_current_user_flexible(
    request: Request,
    db: AsyncSession,
    api_key: Optional[str] = None
) -> User:
    """Get user from either API key (in request body or Authorization header) or JWT token (in Authorization header)."""
    # Try Authorization header first
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        # Check if it's a Luminal API key (starts with lum_)
        if token.startswith("lum_"):
            return await get_current_user_from_api_key(token, db)
        # Otherwise try JWT token (for dashboard)
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if user_id:
                result = await db.execute(select(User).where(User.id == int(user_id)))
                user = result.scalar_one_or_none()
                if user and user.is_active:
                    return user
        except Exception:
            pass
    
    # Fall back to API key in request body (for API clients)
    if api_key:
        return await get_current_user_from_api_key(api_key, db)
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def check_rate_limit_dependency(request: Request, body: RouteRequest):
    # Extract API key from Authorization header or request body for rate limiting
    api_key = ""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        if token.startswith("lum_"):
            api_key = token
    if not api_key and body.api_key:
        api_key = body.api_key
    
    key = f"rate_limit:{api_key}"
    allowed, used, limit = await check_rate_limit(key, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded",
            headers={"X-RateLimit-Limit": str(limit), "X-RateLimit-Remaining": "0"}
        )
    return {"limit": limit, "remaining": limit - used}


def _resolve_session_id(body: RouteRequest, user: User) -> str:
    # Reuse the client-supplied session_id to continue a conversation,
    # otherwise start a new one. Only accept session_ids this user owns
    # (they're prefixed with the owning user's id) to prevent one user
    # from resuming another user's conversation thread.
    if body.session_id and body.session_id.startswith(f"user_{user.id}_"):
        return body.session_id
    return f"user_{user.id}_{uuid.uuid4().hex[:12]}"


async def _finalize_agent_result(
    db: AsyncSession, user: User, prompt: str, session_id: str, result: dict
) -> RouteResponse:
    """Turn a run_agent()/resume_agent() result dict into a logged RouteResponse.

    A run that's still waiting on human approval (approval_required, no
    response yet, no error) is not logged/billed — nothing happened yet.
    """
    if hasattr(result, "to_dict"):
        result = result.to_dict()

    response_content = result.get("response", "")
    model_used = result.get("selected_model", "unknown")
    selected_provider = result.get("selected_provider", "openrouter")
    complexity = result.get("complexity")
    prompt_tokens = result.get("prompt_tokens", 0)
    completion_tokens = result.get("completion_tokens", 0)
    tokens_used = result.get("tokens_used", 0)
    cost = result.get("cost", 0.0)
    latency_ms = result.get("latency_ms", 0)
    quality_score = result.get("quality_score")
    error = result.get("error")

    used_rag = result.get("used_rag", False)
    citations = result.get("citations", [])
    tools_used = result.get("tools_used", [])
    tool_results = result.get("tool_results", [])

    if error:
        is_payment = (
            "402" in error
            or "Payment Required" in error
            or "payment required" in error.lower()
        )
        is_auth = (
            "401" in error
            or "Unauthorized" in error
            or "Authentication error" in error
            or "authentication" in error.lower()
        )
        is_denied = error == "User denied approval"
        status_code = 402 if is_payment else 401 if is_auth else 403 if is_denied else 500
        raise HTTPException(status_code=status_code, detail=error)

    if result.get("approval_required") and not response_content:
        raise HTTPException(
            status_code=202,
            detail={
                "message": "Awaiting approval for a tool action",
                "session_id": session_id,
                "pending_approval": result.get("pending_approval"),
            },
        )

    log = ExecutionLog(
        user_id=user.id,
        prompt=prompt,
        model_used=model_used,
        provider=selected_provider,
        complexity=complexity,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=tokens_used,
        cost=cost,
        latency_ms=latency_ms,
        quality_score=quality_score,
        error_message=error,
        retrieval_metadata={"used_rag": used_rag, "citations": citations} if used_rag else None,
        tool_metadata={"tools_used": tools_used, "tool_calls": tool_results} if tools_used else None
    )
    db.add(log)
    await add_spend(db, user.id, cost)
    await db.commit()

    complexity_str = complexity
    if hasattr(complexity, 'value'):
        complexity_str = complexity.value
    elif complexity is None:
        complexity_str = "low"

    return RouteResponse(
        content=response_content,
        model=model_used,
        complexity=complexity_str,
        tokens_used=tokens_used,
        cost=cost,
        latency_ms=latency_ms,
        session_id=session_id,
        citations=citations
    )


@router.post("", response_model=RouteResponse)
async def route_prompt(
    request: Request,
    body: RouteRequest,
    db: AsyncSession = Depends(get_db),
    rate_limit: dict = Depends(check_rate_limit_dependency)
):
    user = await get_current_user_flexible(request, db, body.api_key or None)

    await check_and_reset_budget(db, user.id)

    budget_status = await get_budget_status(db, user.id)
    if budget_status.get("is_over_budget"):
        raise HTTPException(status_code=402, detail="Monthly budget exceeded")

    session_id = _resolve_session_id(body, user)

    # Use the LangGraph agent for full trace support
    result = await run_agent(
        session_id=session_id,
        user_id=user.id,
        prompt=body.prompt
    )

    return await _finalize_agent_result(db, user, body.prompt, session_id, result)


@router.post("/approve", response_model=RouteResponse)
async def approve_pending_tool(
    body: ApprovalRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Grant or deny a tool action that's paused on approval_required (see AgentState)."""
    user = await get_current_user_flexible(request, db, None)

    if not body.session_id.startswith(f"user_{user.id}_"):
        raise HTTPException(status_code=404, detail="Session not found")

    result = await resume_agent(body.session_id, approval_granted=body.approved)
    if result is None:
        raise HTTPException(status_code=404, detail="Session not found or has no pending state")

    prior_state = result if isinstance(result, dict) else {}
    prompt = prior_state.get("current_prompt", "")

    return await _finalize_agent_result(db, user, prompt, body.session_id, result)


@router.post("/stream")
async def route_prompt_stream(
    request: Request,
    body: RouteRequest,
    db: AsyncSession = Depends(get_db),
    rate_limit: dict = Depends(check_rate_limit_dependency)
):
    """Token-streaming variant of /route.

    Uses the same routing/RAG/tool-calling building blocks as the LangGraph
    agent pipeline (app/services/agent/nodes.py) so results don't drift from
    /route. Tools that require approval and the critic/regeneration loop are
    not supported here — both need a complete response before they can act,
    which is incompatible with token-by-token delivery — so this endpoint
    skips approval-gated tools (falls back to not calling them) and always
    accepts the first generation.
    """
    user = await get_current_user_flexible(request, db, body.api_key or None)

    await check_and_reset_budget(db, user.id)

    budget_status = await get_budget_status(db, user.id)
    if budget_status.get("is_over_budget"):
        raise HTTPException(status_code=402, detail="Monthly budget exceeded")

    session_id = _resolve_session_id(body, user)

    complexity = await score_complexity_hybrid(body.prompt)
    model_config, complexity = await route_request(db, user.id, body.prompt, complexity=complexity)

    rag_result = await inject_context(body.prompt, user.id)

    if settings.use_llm_complexity:
        tool_decision = await decide_tool_call_llm(db, user.id, body.prompt)
    else:
        tool_decision = await decide_tool_call(db, user.id, body.prompt)

    tool_results = []
    if tool_decision.should_call:
        tool = await get_mcp_tool_by_name(db, user.id, tool_decision.tool_name)
        if not (tool and tool.requires_approval):
            tool_results = [await execute_tool_call(db, user.id, tool_decision)]
    tool_context = format_tool_results(tool_results)

    augmented_prompt = rag_result.augmented_prompt + tool_context if tool_context else rag_result.augmented_prompt
    messages = [{"role": "user", "content": augmented_prompt}]

    provider_obj = ProviderRegistry.get(model_config.provider)
    if not provider_obj:
        provider_obj = ProviderRegistry.get_for_model(model_config.model_name)
    if not provider_obj:
        provider_obj = ProviderRegistry.get("ollama") or ProviderRegistry.get("openrouter")

    async def generate():
        full_content = ""

        if not provider_obj:
            yield f"data: {json.dumps({'error': 'No provider available', 'done': True})}\n\n"
            return

        try:
            async for chunk in provider_obj.chat_completion_stream(
                model=model_config.model_name,
                messages=messages,
                max_tokens=model_config.max_tokens,
                temperature=float(model_config.temperature)
            ):
                full_content += chunk
                yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"

            # Streaming responses don't carry exact usage from every provider,
            # so token counts are estimated from content length (~1.3 tokens/word).
            estimated_completion_tokens = int(len(full_content.split()) * 1.3)
            prompt_text = " ".join(m.get("content", "") for m in messages)
            estimated_prompt_tokens = int(len(prompt_text.split()) * 1.3)

            cost = provider_obj.calculate_cost(
                model_config.model_name,
                estimated_prompt_tokens,
                estimated_completion_tokens
            )

            log = ExecutionLog(
                user_id=user.id,
                prompt=body.prompt,
                model_used=model_config.model_name,
                provider=model_config.provider,
                complexity=complexity,
                prompt_tokens=estimated_prompt_tokens,
                completion_tokens=estimated_completion_tokens,
                total_tokens=estimated_prompt_tokens + estimated_completion_tokens,
                cost=cost,
                latency_ms=0,
                retrieval_metadata={"used_rag": rag_result.used_rag, "citations": rag_result.citations} if rag_result.used_rag else None,
                tool_metadata={"tool_calls": [{"tool": r.tool_name, "success": r.success, "result": r.result, "error": r.error} for r in tool_results]} if tool_results else None
            )
            db.add(log)
            await add_spend(db, user.id, cost)
            await db.commit()

            yield f"data: {json.dumps({'content': '', 'done': True, 'model': model_config.model_name, 'cost': cost, 'session_id': session_id, 'citations': rag_result.citations})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/trace/{session_id}")
async def stream_trace(session_id: str):
    """Stream live trace events for a session."""
    async def event_generator():
        last_trace_len = 0
        while True:
            state = await get_agent_state(session_id)
            if state and state.get("trace"):
                trace = state["trace"]
                for entry in trace[last_trace_len:]:
                    yield f"data: {json.dumps(entry)}\n\n"
                last_trace_len = len(trace)
            
            if state and state.get("completed_at"):
                yield f"data: {json.dumps({'done': True, 'session_id': session_id})}\n\n"
                break
            await asyncio.sleep(0.3)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Allow-Headers": "*",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )