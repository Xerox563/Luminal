from typing import Optional, List
from dataclasses import dataclass
from app.services.embedding import EmbeddingService
from app.services.vector_store.base import DocumentChunk, VectorStoreRegistry
from app.core.config import settings


@dataclass
class RetrievalResult:
    chunks: List[DocumentChunk]
    query: str
    total_chunks: int
    retrieval_time_ms: int


async def retrieve(
    query: str,
    user_id: int,
    k: int = 5,
    score_threshold: float = 0.5,
    filter_metadata: Optional[dict] = None
) -> RetrievalResult:
    import time
    start_time = time.time()
    
    query_embedding = EmbeddingService.embed_text(query)
    
    metadata_filter = {"user_id": user_id}
    if filter_metadata:
        metadata_filter.update(filter_metadata)
    
    vector_store = VectorStoreRegistry.get(settings.vector_store)
    if not vector_store:
        vector_store = VectorStoreRegistry.get_default()
    
    chunks = []
    if vector_store:
        chunks = await vector_store.search(
            query_embedding=query_embedding,
            k=k,
            filter_metadata=metadata_filter
        )
    
    filtered_chunks = [
        chunk for chunk in chunks
        if chunk.score is None or chunk.score >= score_threshold
    ]
    
    retrieval_time = int((time.time() - start_time) * 1000)
    
    return RetrievalResult(
        chunks=filtered_chunks,
        query=query,
        total_chunks=len(filtered_chunks),
        retrieval_time_ms=retrieval_time
    )


async def retrieve_for_rag(
    query: str,
    user_id: int,
    k: int = 3,
    score_threshold: float = 0.6
) -> RetrievalResult:
    return await retrieve(
        query=query,
        user_id=user_id,
        k=k,
        score_threshold=score_threshold
    )