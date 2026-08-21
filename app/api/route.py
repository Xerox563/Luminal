from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.services.auth import get_current_user_from_api_key, decode_token, settings
from app.services.router import route_request
from app.services.openrouter import call_openrouter, calculate_cost
from app.services.budget import add_spend, get_budget_status, check_and_reset_budget
from app.services.cache import generate_cache_key, get_cached_response, set_cached_response
from app.services.retry import execute_with_fallback
from app.services.rate_limit import check_rate_limit
from app.services.rag import inject_context, format_response_with_citations
from app.services.tool_calling import decide_tool_call, decide_tool_call_llm
from app.services.tool_execution import process_tool_calls, format_tool_results
from app.services.providers import ProviderRegistry
from app.services.agent.graph import run_agent, get_agent_state
from app.models import ExecutionLog, User
from app.schemas.route import RouteRequest, RouteResponse
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
    
    # Generate session ID for trace tracking
    session_id = f"user_{user.id}_{uuid.uuid4().hex[:12]}"
    
    # Use the LangGraph agent for full trace support
    result = await run_agent(
        session_id=session_id,
        user_id=user.id,
        prompt=body.prompt
    )
    
    # Extract response from agent state
    response_content = result.get("response", "")
    model_used = result.get("selected_model", "unknown")
    complexity = result.get("complexity")
    tokens_used = result.get("tokens_used", 0)
    cost = result.get("cost", 0.0)
    latency_ms = result.get("latency_ms", 0)
    error = result.get("error")
    
    if error:
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {error}")
    
    # Log to execution log
    log = ExecutionLog(
        user_id=user.id,
        prompt=body.prompt,
        model_used=model_used,
        provider="openrouter",
        complexity=complexity,
        prompt_tokens=0,
        completion_tokens=tokens_used,
        total_tokens=tokens_used,
        cost=cost,
        latency_ms=latency_ms,
        error_message=error,
        retrieval_metadata=result.get("retrieval_metadata"),
        tool_metadata=result.get("tool_metadata")
    )
    db.add(log)
    await add_spend(db, user.id, cost)
    await db.commit()
    
    return RouteResponse(
        content=response_content,
        model=model_used,
        complexity=complexity.value if complexity else "low",
        tokens_used=tokens_used,
        cost=cost,
        latency_ms=latency_ms,
        session_id=session_id
    )


@router.post("/stream")
async def route_prompt_stream(
    request: Request,
    body: RouteRequest,
    db: AsyncSession = Depends(get_db),
    rate_limit: dict = Depends(check_rate_limit_dependency)
):
    user = await get_current_user_flexible(request, db, body.api_key)
    
    await check_and_reset_budget(db, user.id)
    
    budget_status = await get_budget_status(db, user.id)
    if budget_status.get("is_over_budget"):
        raise HTTPException(status_code=402, detail="Monthly budget exceeded")
    
    model_config, complexity = await route_request(db, user.id, body.prompt)
    
    rag_result = await inject_context(body.prompt, user.id)
    
    tool_results = await process_tool_calls(body.prompt, use_llm=settings.use_llm_complexity)
    tool_context = format_tool_results(tool_results)
    
    augmented_prompt = rag_result.augmented_prompt
    if tool_context:
        augmented_prompt = augmented_prompt.replace(
            "Question: " + body.prompt,
            "Question: " + body.prompt + tool_context
        )
    
    messages = [{"role": "user", "content": augmented_prompt}]
    
    provider_obj = ProviderRegistry.get(model_config.provider)
    if not provider_obj:
        provider_obj = ProviderRegistry.get_for_model(model_config.model_name)
    if not provider_obj:
        provider_obj = ProviderRegistry.get("openrouter")
    
    async def generate():
        full_content = ""
        prompt_tokens = 0
        completion_tokens = 0
        total_tokens = 0
        
        try:
            async for chunk in provider_obj.chat_completion_stream(
                model=model_config.model_name,
                messages=messages,
                max_tokens=model_config.max_tokens,
                temperature=float(model_config.temperature)
            ):
                full_content += chunk
                yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"
            
            # Get actual token usage from the provider
            # For OpenRouter, the last chunk contains usage info
            # We'll use the non-streaming method to get accurate usage
            # For now, estimate based on content length
            estimated_completion_tokens = len(full_content.split()) * 1.3
            # Estimate prompt tokens based on message length
            prompt_text = " ".join([m.get("content", "") for m in messages])
            estimated_prompt_tokens = len(prompt_text.split()) * 1.3
            
            cost = provider_obj.calculate_cost(
                model_config.model_name, 
                int(estimated_prompt_tokens), 
                int(estimated_completion_tokens)
            )
            
            log = ExecutionLog(
                user_id=user.id,
                prompt=body.prompt,
                model_used=model_config.model_name,
                provider=model_config.provider,
                complexity=complexity,
                prompt_tokens=int(estimated_prompt_tokens),
                completion_tokens=int(estimated_completion_tokens),
                total_tokens=int(estimated_prompt_tokens + estimated_completion_tokens),
                cost=cost,
                latency_ms=0,
                retrieval_metadata={"used_rag": rag_result.used_rag, "citations": rag_result.citations} if rag_result.used_rag else None,
                tool_metadata={"tool_calls": [{"tool": r.tool_name, "success": r.success, "result": r.result, "error": r.error} for r in tool_results]} if tool_results else None
            )
            db.add(log)
            await add_spend(db, user.id, cost)
            await db.commit()
            
            yield f"data: {json.dumps({'content': '', 'done': True, 'model': model_config.model_name, 'cost': cost})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"
    
    import json
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