from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from app.db.session import get_db
from app.services.auth import get_current_user
from app.services.retrieval import retrieve, RetrievalResult
from app.models import User

router = APIRouter(prefix="/retrieval", tags=["retrieval"])


class RetrievalRequest(BaseModel):
    query: str = Field(..., min_length=1)
    k: int = Field(5, ge=1, le=20)
    score_threshold: float = Field(0.5, ge=0.0, le=1.0)
    filter_metadata: Optional[dict] = None


class ChunkResponse(BaseModel):
    id: str
    content: str
    metadata: dict
    score: Optional[float] = None


class RetrievalResponse(BaseModel):
    query: str
    chunks: List[ChunkResponse]
    total_chunks: int
    retrieval_time_ms: int


@router.post("/search", response_model=RetrievalResponse)
async def search_documents(
    request: RetrievalRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    result = await retrieve(
        query=request.query,
        user_id=current_user.id,
        k=request.k,
        score_threshold=request.score_threshold,
        filter_metadata=request.filter_metadata
    )
    
    return RetrievalResponse(
        query=result.query,
        chunks=[
            ChunkResponse(
                id=chunk.id,
                content=chunk.content,
                metadata=chunk.metadata,
                score=chunk.score
            )
            for chunk in result.chunks
        ],
        total_chunks=result.total_chunks,
        retrieval_time_ms=result.retrieval_time_ms
    )