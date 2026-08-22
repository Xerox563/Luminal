from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings


def _normalize_database_url(url: str) -> str:
    # Managed Postgres providers (Render, Heroku, etc.) hand out plain
    # postgres:// or postgresql:// connection strings, but SQLAlchemy's
    # async engine needs the asyncpg driver named explicitly.
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://"):]
    return url


engine = create_async_engine(_normalize_database_url(settings.database_url), echo=settings.debug)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session_maker() as session:
        yield session