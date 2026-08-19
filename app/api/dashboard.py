from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field
from app.db.session import get_db
from app.services.auth import get_current_user
from app.models import ExecutionLog, User
from app.services.budget import get_budget_status, update_budget, reset_monthly_budget

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class BudgetUpdate(BaseModel):
    monthly_budget: float = Field(..., ge=0)


@router.get("/budget")
async def get_budget(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_budget_status(db, current_user.id)


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
                "date": d.date.isoformat(),
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