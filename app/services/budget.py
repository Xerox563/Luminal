from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime
from app.models import User


async def check_and_reset_budget(db: AsyncSession, user_id: int) -> None:
    """Check if budget needs to be reset (new month) and reset if needed."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return
    
    # user.updated_at is stored via datetime.utcnow(), so the month boundary
    # must use UTC "today" too, not the server's local date.
    today = datetime.utcnow()
    first_of_month = datetime(today.year, today.month, 1)
    
    # Check if user's spend was last updated before the 1st of this month
    if user.updated_at and user.updated_at < first_of_month and user.current_spend > 0:
        user.current_spend = 0
        user.updated_at = datetime.utcnow()
        await db.commit()


async def reset_monthly_budget(db: AsyncSession) -> int:
    # user.updated_at is stored via datetime.utcnow(), so the month boundary
    # must use UTC "today" too, not the server's local date.
    today = datetime.utcnow()
    first_of_month = datetime(today.year, today.month, 1)
    
    result = await db.execute(
        update(User)
        .where(User.current_spend > 0)
        .where(User.updated_at < first_of_month)
        .values(current_spend=0, updated_at=datetime.utcnow())
    )
    await db.commit()
    return result.rowcount


async def get_budget_status(db: AsyncSession, user_id: int) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {"error": "User not found"}
    
    budget = float(user.monthly_budget or 0)
    spent = float(user.current_spend or 0)
    remaining = budget - spent
    percent_used = (spent / budget * 100) if budget > 0 else 0
    
    return {
        "monthly_budget": budget,
        "current_spend": spent,
        "remaining": max(0, remaining),
        "percent_used": round(percent_used, 2),
        "is_over_budget": spent > budget,
        "alert_threshold_80": spent > budget * 0.8,
        "alert_threshold_95": spent > budget * 0.95
    }


async def update_budget(db: AsyncSession, user_id: int, new_budget: float) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None
    
    user.monthly_budget = new_budget
    await db.commit()
    await db.refresh(user)
    return user


async def add_spend(db: AsyncSession, user_id: int, amount: float) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None
    
    # Check and reset budget first
    await check_and_reset_budget(db, user_id)
    
    # Refresh user after potential reset
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None
    
    user.current_spend = float(user.current_spend or 0) + amount
    user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)
    return user