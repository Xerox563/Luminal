from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.init_db import init_db
from app.api import auth, route, dashboard, documents, retrieval, mcp
from app.db.base import Base
from app.services.providers import init_providers
from app.services.vector_store import init_vector_stores
from app.services.mcp import init_mcp_services

app = FastAPI(
    title="Luminal",
    description="Intelligent LLM Routing Gateway",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(auth.api_key_router)
app.include_router(route.router)
app.include_router(dashboard.router)
app.include_router(documents.router)
app.include_router(retrieval.router)
app.include_router(mcp.router)


@app.on_event("startup")
async def startup():
    await init_db()
    init_providers()
    init_vector_stores()
    init_mcp_services()
    from app.db.session import AsyncSession
    from app.db.session import engine
    from app.services import runtime_settings
    async with AsyncSession(engine) as db:
        await runtime_settings.load_settings(db)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}