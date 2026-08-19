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
            "created_at": log.created_at.isoformat()
        }
        for log in logs
    ]