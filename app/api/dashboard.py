from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.db.session import get_db
from app.services.auth import get_current_user
from app.models import ExecutionLog, User, ProviderName, ComplexityLevel
from app.services.budget import get_budget_status, update_budget, reset_monthly_budget
from app.services import runtime_settings
from app.services.provider_key import (
    create_provider_key, get_all_provider_keys, delete_provider_key, get_provider_key_decrypted
)
from app.services.mcp_tool import (
    create_mcp_tool, get_all_mcp_tools, get_mcp_tool, delete_mcp_tool, update_mcp_tool
)
from app.services.model_config import (
    create_model_config, get_model_configs, get_model_config, update_model_config, delete_model_config
)
from app.services.vector_store.base import VectorStoreRegistry
from app.core.config import settings
from app.schemas.provider_key import ProviderKeyCreate, ProviderKeyUpdate, ProviderKeyResponse, ProviderKeyListResponse
from app.schemas.mcp_tool import MCPToolCreate, MCPToolUpdate, MCPToolResponse, MCPToolListResponse
from app.schemas.model_config import ModelConfigCreate, ModelConfigUpdate, ModelConfigResponse, ModelConfigListResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class BudgetUpdate(BaseModel):
    monthly_budget: float = Field(..., ge=0)


class SettingsUpdate(BaseModel):
    openrouter_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    openrouter_base_url: Optional[str] = None
    openai_base_url: Optional[str] = None
    anthropic_base_url: Optional[str] = None
    deepseek_base_url: Optional[str] = None
    ollama_base_url: Optional[str] = None
    use_llm_complexity: Optional[bool] = None
    default_provider: Optional[str] = None


@router.get("/budget")
async def get_budget(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_budget_status(db, current_user.id)


@router.get("/settings")
async def get_settings(
    current_user: User = Depends(get_current_user)
):
    return runtime_settings.settings_summary()


@router.put("/settings")
async def update_settings(
    data: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    updates = data.model_dump(exclude_none=True)
    for key, value in updates.items():
        if key == "use_llm_complexity":
            await runtime_settings.set_setting(db, key, "true" if value else "false")
        elif key == "default_provider":
            await runtime_settings.set_setting(db, key, value or "")
        elif value != "":
            await runtime_settings.set_setting(db, key, value)
    return runtime_settings.settings_summary()


# Provider Keys endpoints
@router.get("/provider-keys", response_model=ProviderKeyListResponse)
async def list_provider_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    keys = await get_all_provider_keys(db, current_user.id)
    return ProviderKeyListResponse(
        keys=[
            ProviderKeyResponse(
                id=k.id,
                provider=k.provider,
                base_url=k.base_url,
                is_active=k.is_active,
                created_at=k.created_at.isoformat(),
                updated_at=k.updated_at.isoformat(),
                has_key=bool(k.encrypted_key)
            )
            for k in keys
        ]
    )


@router.post("/provider-keys", response_model=ProviderKeyResponse, status_code=201)
async def add_provider_key(
    data: ProviderKeyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    provider_key = await create_provider_key(db, current_user.id, data.provider, data.api_key, data.base_url)
    return ProviderKeyResponse(
        id=provider_key.id,
        provider=provider_key.provider,
        base_url=provider_key.base_url,
        is_active=provider_key.is_active,
        created_at=provider_key.created_at.isoformat(),
        updated_at=provider_key.updated_at.isoformat(),
        has_key=True
    )


@router.patch("/provider-keys/{provider}")
async def update_provider_key(
    provider: ProviderName,
    data: ProviderKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.provider_key import get_provider_key
    provider_key = await get_provider_key(db, current_user.id, provider)
    if not provider_key:
        raise HTTPException(status_code=404, detail="Provider key not found")
    
    updates = data.model_dump(exclude_none=True)
    if "api_key" in updates:
        from app.services.auth import encrypt_provider_key
        provider_key.encrypted_key = encrypt_provider_key(updates.pop("api_key"))
    for key, value in updates.items():
        setattr(provider_key, key, value)
    provider_key.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(provider_key)
    
    return ProviderKeyResponse(
        id=provider_key.id,
        provider=provider_key.provider,
        base_url=provider_key.base_url,
        is_active=provider_key.is_active,
        created_at=provider_key.created_at.isoformat(),
        updated_at=provider_key.updated_at.isoformat(),
        has_key=bool(provider_key.encrypted_key)
    )


@router.delete("/provider-keys/{provider}")
async def remove_provider_key(
    provider: ProviderName,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    success = await delete_provider_key(db, current_user.id, provider)
    if not success:
        raise HTTPException(status_code=404, detail="Provider key not found")
    return {"message": f"Provider key for {provider} deleted"}


# MCP Tools endpoints
@router.get("/mcp-tools", response_model=MCPToolListResponse)
async def list_mcp_tools(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    tools = await get_all_mcp_tools(db, current_user.id)
    return MCPToolListResponse(
        tools=[
            MCPToolResponse(
                id=t.id,
                name=t.name,
                description=t.description,
                endpoint_url=t.endpoint_url,
                auth_type=t.auth_type,
                auth_config=t.auth_config,
                trigger_keywords=t.trigger_keywords,
                parameters_schema=t.parameters_schema,
                requires_approval=t.requires_approval,
                is_active=t.is_active,
                created_at=t.created_at.isoformat(),
                updated_at=t.updated_at.isoformat()
            )
            for t in tools
        ]
    )


@router.post("/mcp-tools", response_model=MCPToolResponse, status_code=201)
async def add_mcp_tool(
    data: MCPToolCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    tool = await create_mcp_tool(
        db, current_user.id, data.name, data.endpoint_url,
        data.description, data.auth_type, data.auth_config,
        data.trigger_keywords, data.parameters_schema, data.requires_approval
    )
    return MCPToolResponse(
        id=tool.id,
        name=tool.name,
        description=tool.description,
        endpoint_url=tool.endpoint_url,
        auth_type=tool.auth_type,
        auth_config=tool.auth_config,
        trigger_keywords=tool.trigger_keywords,
        parameters_schema=tool.parameters_schema,
        requires_approval=tool.requires_approval,
        is_active=tool.is_active,
        created_at=tool.created_at.isoformat(),
        updated_at=tool.updated_at.isoformat()
    )


@router.patch("/mcp-tools/{tool_id}")
async def update_mcp_tool_endpoint(
    tool_id: int,
    data: MCPToolUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    tool = await get_mcp_tool(db, current_user.id, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="MCP tool not found")
    
    updates = data.model_dump(exclude_none=True)
    tool = await update_mcp_tool(db, tool, updates)
    return MCPToolResponse(
        id=tool.id,
        name=tool.name,
        description=tool.description,
        endpoint_url=tool.endpoint_url,
        auth_type=tool.auth_type,
        auth_config=tool.auth_config,
        trigger_keywords=tool.trigger_keywords,
        parameters_schema=tool.parameters_schema,
        requires_approval=tool.requires_approval,
        is_active=tool.is_active,
        created_at=tool.created_at.isoformat(),
        updated_at=tool.updated_at.isoformat()
    )


@router.delete("/mcp-tools/{tool_id}")
async def remove_mcp_tool(
    tool_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    tool = await get_mcp_tool(db, current_user.id, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="MCP tool not found")
    await delete_mcp_tool(db, tool)
    return {"message": f"MCP tool {tool.name} deleted"}


@router.patch("/budget")
async def set_budget(
    budget_data: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user = await update_budget(db, current_user.id, budget_data.monthly_budget)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"monthly_budget": float(user.monthly_budget), "message": "Budget updated"}


@router.post("/budget/reset")
async def reset_budget(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await reset_monthly_budget(db)
    return {"message": "Monthly budget reset"}


@router.get("/stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    today = date.today()
    start_of_day = datetime.combine(today, datetime.min.time())
    start_of_month = datetime(today.year, today.month, 1)
    
    today_result = await db.execute(
        select(
            func.count(ExecutionLog.id).label("requests"),
            func.coalesce(func.sum(ExecutionLog.cost), 0).label("cost"),
            func.coalesce(func.sum(ExecutionLog.total_tokens), 0).label("tokens"),
            func.coalesce(func.avg(ExecutionLog.latency_ms), 0).label("avg_latency")
        )
        .where(ExecutionLog.user_id == current_user.id)
        .where(ExecutionLog.created_at >= start_of_day)
    )
    today_stats = today_result.first()
    
    month_result = await db.execute(
        select(
            func.count(ExecutionLog.id).label("requests"),
            func.coalesce(func.sum(ExecutionLog.cost), 0).label("cost"),
            func.coalesce(func.sum(ExecutionLog.total_tokens), 0).label("tokens")
        )
        .where(ExecutionLog.user_id == current_user.id)
        .where(ExecutionLog.created_at >= start_of_month)
    )
    month_stats = month_result.first()
    
    model_result = await db.execute(
        select(
            ExecutionLog.model_used,
            func.count(ExecutionLog.id).label("requests"),
            func.coalesce(func.sum(ExecutionLog.cost), 0).label("cost"),
            func.coalesce(func.sum(ExecutionLog.total_tokens), 0).label("tokens")
        )
        .where(ExecutionLog.user_id == current_user.id)
        .where(ExecutionLog.created_at >= start_of_month)
        .group_by(ExecutionLog.model_used)
    )
    model_stats = model_result.all()
    
    return {
        "today": {
            "requests": today_stats.requests or 0,
            "cost": float(today_stats.cost or 0),
            "tokens": today_stats.tokens or 0,
            "avg_latency_ms": float(today_stats.avg_latency or 0)
        },
        "month": {
            "requests": month_stats.requests or 0,
            "cost": float(month_stats.cost or 0),
            "tokens": month_stats.tokens or 0,
            "budget": float(current_user.monthly_budget),
            "budget_remaining": float(current_user.monthly_budget - (month_stats.cost or 0))
        },
        "by_model": [
            {
                "model": m.model_used,
                "requests": m.requests,
                "cost": float(m.cost),
                "tokens": m.tokens
            }
            for m in model_stats
        ]
    }


@router.get("/cost-breakdown")
async def get_cost_breakdown(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    start_date = datetime.utcnow() - timedelta(days=days)
    
    daily_result = await db.execute(
        select(
            func.date(ExecutionLog.created_at).label("date"),
            func.count(ExecutionLog.id).label("requests"),
            func.coalesce(func.sum(ExecutionLog.cost), 0).label("cost"),
            func.coalesce(func.sum(ExecutionLog.total_tokens), 0).label("tokens")
        )
        .where(ExecutionLog.user_id == current_user.id)
        .where(ExecutionLog.created_at >= start_date)
        .group_by(func.date(ExecutionLog.created_at))
        .order_by(func.date(ExecutionLog.created_at))
    )
    daily_stats = daily_result.all()
    
    complexity_result = await db.execute(
        select(
            ExecutionLog.complexity,
            func.count(ExecutionLog.id).label("requests"),
            func.coalesce(func.sum(ExecutionLog.cost), 0).label("cost"),
            func.coalesce(func.avg(ExecutionLog.latency_ms), 0).label("avg_latency")
        )
        .where(ExecutionLog.user_id == current_user.id)
        .where(ExecutionLog.created_at >= start_date)
        .group_by(ExecutionLog.complexity)
    )
    complexity_stats = complexity_result.all()
    
    provider_result = await db.execute(
        select(
            ExecutionLog.provider,
            func.count(ExecutionLog.id).label("requests"),
            func.coalesce(func.sum(ExecutionLog.cost), 0).label("cost")
        )
        .where(ExecutionLog.user_id == current_user.id)
        .where(ExecutionLog.created_at >= start_date)
        .group_by(ExecutionLog.provider)
    )
    provider_stats = provider_result.all()
    
    return {
        "daily": [
            {
                "date": str(d.date) if d.date else "",
                "requests": d.requests,
                "cost": float(d.cost),
                "tokens": d.tokens
            }
            for d in daily_stats
        ],
        "by_complexity": [
            {
                "complexity": c.complexity.value if c.complexity else "unknown",
                "requests": c.requests,
                "cost": float(c.cost),
                "avg_latency_ms": float(c.avg_latency)
            }
            for c in complexity_stats
        ],
        "by_provider": [
            {
                "provider": p.provider,
                "requests": p.requests,
                "cost": float(p.cost)
            }
            for p in provider_stats
        ]
    }


@router.get("/model-performance")
async def get_model_performance(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    start_date = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(
            ExecutionLog.model_used,
            func.count(ExecutionLog.id).label("requests"),
            func.coalesce(func.sum(ExecutionLog.cost), 0).label("cost"),
            func.coalesce(func.sum(ExecutionLog.total_tokens), 0).label("tokens"),
            func.coalesce(func.avg(ExecutionLog.latency_ms), 0).label("avg_latency"),
            func.coalesce(func.avg(ExecutionLog.quality_score), 0).label("avg_quality"),
            func.count(ExecutionLog.id).filter(ExecutionLog.error_message.isnot(None)).label("errors")
        )
        .where(ExecutionLog.user_id == current_user.id)
        .where(ExecutionLog.created_at >= start_date)
        .group_by(ExecutionLog.model_used)
    )
    stats = result.all()
    
    return [
        {
            "model": s.model_used,
            "requests": s.requests,
            "cost": float(s.cost),
            "tokens": s.tokens,
            "avg_latency_ms": float(s.avg_latency),
            "avg_quality_score": float(s.avg_quality) if s.avg_quality else None,
            "error_rate": round(s.errors / s.requests * 100, 2) if s.requests > 0 else 0
        }
        for s in stats
    ]


@router.get("/logs")
async def get_logs(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ExecutionLog)
        .where(ExecutionLog.user_id == current_user.id)
        .order_by(ExecutionLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    logs = result.scalars().all()
    
    return [
        {
            "id": log.id,
            "prompt": log.prompt[:100] + "..." if len(log.prompt) > 100 else log.prompt,
            "model_used": log.model_used,
            "complexity": log.complexity.value if log.complexity else None,
            "total_tokens": log.total_tokens,
            "cost": float(log.cost),
            "latency_ms": log.latency_ms,
            "quality_score": float(log.quality_score) if log.quality_score else None,
            "error_message": log.error_message,
            "retrieval_metadata": log.retrieval_metadata,
            "tool_metadata": log.tool_metadata,
            "created_at": log.created_at.isoformat()
        }
        for log in logs
    ]


@router.get("/rag-stats")
async def get_rag_stats(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    start_date = datetime.utcnow() - timedelta(days=days)
    
    rag_result = await db.execute(
        select(
            func.count(ExecutionLog.id).filter(ExecutionLog.retrieval_metadata.isnot(None)).label("rag_requests"),
            func.count(ExecutionLog.id).filter(ExecutionLog.retrieval_metadata.is_(None)).label("non_rag_requests"),
            func.avg(ExecutionLog.latency_ms).filter(ExecutionLog.retrieval_metadata.isnot(None)).label("rag_avg_latency"),
            func.avg(ExecutionLog.latency_ms).filter(ExecutionLog.retrieval_metadata.is_(None)).label("non_rag_avg_latency"),
            func.avg(ExecutionLog.cost).filter(ExecutionLog.retrieval_metadata.isnot(None)).label("rag_avg_cost"),
            func.avg(ExecutionLog.cost).filter(ExecutionLog.retrieval_metadata.is_(None)).label("non_rag_avg_cost")
        )
        .where(ExecutionLog.user_id == current_user.id)
        .where(ExecutionLog.created_at >= start_date)
    )
    rag_stats = rag_result.first()
    
    tool_result = await db.execute(
        select(
            func.count(ExecutionLog.id).filter(ExecutionLog.tool_metadata.isnot(None)).label("tool_requests"),
            func.count(ExecutionLog.id).filter(ExecutionLog.tool_metadata.is_(None)).label("non_tool_requests"),
            func.avg(ExecutionLog.latency_ms).filter(ExecutionLog.tool_metadata.isnot(None)).label("tool_avg_latency")
        )
        .where(ExecutionLog.user_id == current_user.id)
        .where(ExecutionLog.created_at >= start_date)
    )
    tool_stats = tool_result.first()
    
    return {
        "rag": {
            "requests": rag_stats.rag_requests or 0,
            "non_rag_requests": rag_stats.non_rag_requests or 0,
            "rag_percentage": round((rag_stats.rag_requests or 0) / max(1, (rag_stats.rag_requests or 0) + (rag_stats.non_rag_requests or 0)) * 100, 2),
            "avg_latency_ms": float(rag_stats.rag_avg_latency or 0),
            "non_rag_avg_latency_ms": float(rag_stats.non_rag_avg_latency or 0),
            "avg_cost": float(rag_stats.rag_avg_cost or 0),
            "non_rag_avg_cost": float(rag_stats.non_rag_avg_cost or 0)
        },
        "tools": {
            "requests": tool_stats.tool_requests or 0,
            "non_tool_requests": tool_stats.non_tool_requests or 0,
            "tool_percentage": round((tool_stats.tool_requests or 0) / max(1, (tool_stats.tool_requests or 0) + (tool_stats.non_tool_requests or 0)) * 100, 2),
            "avg_latency_ms": float(tool_stats.tool_avg_latency or 0)
        }
    }


@router.get("/documents")
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    vector_store = VectorStoreRegistry.get(settings.vector_store) or VectorStoreRegistry.get_default()
    if not vector_store:
        return {"documents": [], "total": 0}
    docs = await vector_store.list_documents(current_user.id)
    return {"documents": docs, "total": len(docs)}


# Model Config endpoints
@router.get("/model-configs", response_model=ModelConfigListResponse)
async def list_model_configs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    configs = await get_model_configs(db, current_user.id)
    return ModelConfigListResponse(
        configs=[
            ModelConfigResponse(
                id=c.id,
                complexity=c.complexity,
                model_name=c.model_name,
                provider=c.provider,
                max_tokens=c.max_tokens,
                temperature=float(c.temperature),
                is_default=c.is_default,
                created_at=c.created_at.isoformat(),
                updated_at=c.updated_at.isoformat()
            )
            for c in configs
        ]
    )


@router.post("/model-configs", response_model=ModelConfigResponse, status_code=201)
async def add_model_config(
    data: ModelConfigCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    config = await create_model_config(
        db, current_user.id, data.complexity, data.model_name,
        data.provider, data.max_tokens, data.temperature, data.is_default
    )
    return ModelConfigResponse(
        id=config.id,
        complexity=config.complexity,
        model_name=config.model_name,
        provider=config.provider,
        max_tokens=config.max_tokens,
        temperature=float(config.temperature),
        is_default=config.is_default,
        created_at=config.created_at.isoformat(),
        updated_at=config.updated_at.isoformat()
    )


@router.patch("/model-configs/{config_id}")
async def update_model_config_endpoint(
    config_id: int,
    data: ModelConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    config = await get_model_config(db, current_user.id, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Model config not found")
    
    updates = data.model_dump(exclude_none=True)
    config = await update_model_config(db, config, updates)
    return ModelConfigResponse(
        id=config.id,
        complexity=config.complexity,
        model_name=config.model_name,
        provider=config.provider,
        max_tokens=config.max_tokens,
        temperature=float(config.temperature),
        is_default=config.is_default,
        created_at=config.created_at.isoformat(),
        updated_at=config.updated_at.isoformat()
    )


@router.delete("/model-configs/{config_id}")
async def remove_model_config(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    config = await get_model_config(db, current_user.id, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Model config not found")
    await delete_model_config(db, config)
    return {"message": f"Model config for {config.complexity} deleted"}