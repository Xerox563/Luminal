from app.db.base import Base
from app.db.session import engine
from app.models import User, ModelConfig, ComplexityLevel
from app.services.auth import get_password_hash
from sqlalchemy.ext.asyncio import AsyncSession


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create default admin user if not exists.
    # expire_on_commit=False: without it, accessing admin.id right after
    # commit() below triggers a lazy-refresh that needs IO outside of an
    # active greenlet context and crashes app startup on a fresh database.
    async with AsyncSession(engine, expire_on_commit=False) as db:
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == "admin@admin.com"))
        admin = result.scalar_one_or_none()
        if not admin:
            admin = User(
                email="admin@admin.com",
                hashed_password=get_password_hash("admin"),
                is_active=True,
            )
            db.add(admin)
            await db.flush()
            await db.commit()
            admin_id = admin.id
        else:
            admin_id = admin.id

        # Seed default model configurations if the user has none
        result = await db.execute(select(ModelConfig).where(ModelConfig.user_id == admin_id))
        if not result.scalars().first():
            default_configs = [
                {"complexity": "low", "model_name": "mistral:latest", "provider": "ollama", "is_default": True},
                {"complexity": "medium", "model_name": "llama3.2:latest", "provider": "ollama"},
                {"complexity": "high", "model_name": "codellama:latest", "provider": "ollama"},
            ]
            for config in default_configs:
                db.add(ModelConfig(
                    user_id=admin_id,
                    complexity=ComplexityLevel(config["complexity"]),
                    model_name=config["model_name"],
                    provider=config["provider"],
                    is_default=config.get("is_default", False)
                ))
            await db.commit()