from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.auth import get_current_user_from_api_key
from app.services.router import route_request
from app.services.openrouter import call_openrouter, calculate_cost
from app.models import ExecutionLog, User
from app.schemas.route import RouteRequest, RouteResponse

router = APIRouter(prefix="/route", tags=["route"])


@router.post("", response_model=RouteResponse)
async def route_prompt(
    request: RouteRequest,
    db: AsyncSession = Depends(get_db)
):
    user = await get_current_user_from_api_key(request.api_key, db)
    
    model_config, complexity = await route_request(db, user.id, request.prompt)
    
    messages = [{"role": "user", "content": request.prompt}]
    
    try:
        result = await call_openrouter(
            model=model_config.model_name,
            messages=messages,
            max_tokens=model_config.max_tokens,
            temperature=float(model_config.temperature)
        )
        
        cost = calculate_cost(model_config.model_name, result["prompt_tokens"], result["completion_tokens"])
        
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
        
        user.current_spend += cost
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