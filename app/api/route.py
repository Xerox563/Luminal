from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.auth import get_current_user_from_api_key
from app.services.router import route_request
from app.services.openrouter import call_openrouter, calculate_cost
from app.services.budget import add_spend, get_budget_status
from app.services.cache import generate_cache_key, get_cached_response, set_cached_response
from app.services.retry import execute_with_fallback
from app.services.providers import ProviderRegistry
from app.models import ExecutionLog, User
from app.schemas.route import RouteRequest, RouteResponse

router = APIRouter(prefix="/route", tags=["route"])


@router.post("", response_model=RouteResponse)
async def route_prompt(
    request: RouteRequest,
    db: AsyncSession = Depends(get_db)
):
    user = await get_current_user_from_api_key(request.api_key, db)
    
    budget_status = await get_budget_status(db, user.id)
    if budget_status.get("is_over_budget"):
        raise HTTPException(status_code=402, detail="Monthly budget exceeded")
    
    model_config, complexity = await route_request(db, user.id, request.prompt)
    
    messages = [{"role": "user", "content": request.prompt}]
    
    cache_key = generate_cache_key(
        request.prompt,
        model_config.model_name,
        float(model_config.temperature),
        model_config.max_tokens
    )
    
    cached = await get_cached_response(cache_key)
    if cached:
        log = ExecutionLog(
            user_id=user.id,
            prompt=request.prompt,
            model_used=model_config.model_name,
            provider=model_config.provider,
            complexity=complexity,
            prompt_tokens=cached["prompt_tokens"],
            completion_tokens=cached["completion_tokens"],
            total_tokens=cached["total_tokens"],
            cost=cached["cost"],
            latency_ms=0
        )
        db.add(log)
        await add_spend(db, user.id, cached["cost"])
        await db.commit()
        
        return RouteResponse(
            content=cached["content"],
            model=model_config.model_name,
            complexity=complexity.value,
            tokens_used=cached["total_tokens"],
            cost=cached["cost"],
            latency_ms=0
        )
    
    try:
        result = await execute_with_fallback(
            db,
            user.id,
            request.prompt,
            model_config,
            messages,
            model_config.max_tokens,
            float(model_config.temperature)
        )
        
        provider_obj = ProviderRegistry.get(model_config.provider)
        if not provider_obj:
            provider_obj = ProviderRegistry.get_for_model(model_config.model_name)
        cost = provider_obj.calculate_cost(model_config.model_name, result["prompt_tokens"], result["completion_tokens"])
        
        cache_data = {
            "content": result["content"],
            "prompt_tokens": result["prompt_tokens"],
            "completion_tokens": result["completion_tokens"],
            "total_tokens": result["total_tokens"],
            "cost": cost
        }
        await set_cached_response(cache_key, cache_data)
        
        log = ExecutionLog(
            user_id=user.id,
            prompt=request.prompt,
            model_used=model_config.model_name,
            provider=model_config.provider,
            complexity=complexity,
            prompt_tokens=result["prompt_tokens"],
            completion_tokens=result["completion_tokens"],
            total_tokens=result["total_tokens"],
            cost=cost,
            latency_ms=result["latency_ms"]
        )
        db.add(log)
        
        await add_spend(db, user.id, cost)
        await db.commit()
        
        return RouteResponse(
            content=result["content"],
            model=model_config.model_name,
            complexity=complexity.value,
            tokens_used=result["total_tokens"],
            cost=cost,
            latency_ms=result["latency_ms"]
        )
        
    except Exception as e:
        log = ExecutionLog(
            user_id=user.id,
            prompt=request.prompt,
            model_used=model_config.model_name,
            provider=model_config.provider,
            complexity=complexity,
            error_message=str(e)
        )
        db.add(log)
        await db.commit()
        
        raise HTTPException(status_code=500, detail=f"Model call failed: {str(e)}")


@router.post("/stream")
async def route_prompt_stream(
    request: RouteRequest,
    db: AsyncSession = Depends(get_db)
):
    user = await get_current_user_from_api_key(request.api_key, db)
    
    budget_status = await get_budget_status(db, user.id)
    if budget_status.get("is_over_budget"):
        raise HTTPException(status_code=402, detail="Monthly budget exceeded")
    
    model_config, complexity = await route_request(db, user.id, request.prompt)
    
    messages = [{"role": "user", "content": request.prompt}]
    
    provider_obj = ProviderRegistry.get(model_config.provider)
    if not provider_obj:
        provider_obj = ProviderRegistry.get_for_model(model_config.model_name)
    if not provider_obj:
        provider_obj = ProviderRegistry.get("openrouter")
    
    async def generate():
        full_content = ""
        prompt_tokens = 0
        completion_tokens = 0
        
        try:
            async for chunk in provider_obj.chat_completion_stream(
                model=model_config.model_name,
                messages=messages,
                max_tokens=model_config.max_tokens,
                temperature=float(model_config.temperature)
            ):
                full_content += chunk
                yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"
            
            cost = provider_obj.calculate_cost(model_config.model_name, prompt_tokens, len(full_content.split()) * 1.3)
            
            log = ExecutionLog(
                user_id=user.id,
                prompt=request.prompt,
                model_used=model_config.model_name,
                provider=model_config.provider,
                complexity=complexity,
                prompt_tokens=prompt_tokens,
                completion_tokens=int(len(full_content.split()) * 1.3),
                total_tokens=prompt_tokens + int(len(full_content.split()) * 1.3),
                cost=cost,
                latency_ms=0
            )
            db.add(log)
            await add_spend(db, user.id, cost)
            await db.commit()
            
            yield f"data: {json.dumps({'content': '', 'done': True, 'model': model_config.model_name, 'cost': cost})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"
    
    import json
    return StreamingResponse(generate(), media_type="text/event-stream")