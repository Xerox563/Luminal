from typing import Optional
from app.services.vector_store.base import VectorStore, DocumentChunk, VectorStoreRegistry
from app.core.config import settings


class PineconeVectorStore(VectorStore):
    @property
    def name(self) -> str:
        return "pinecone"

    def __init__(self):
        self.index = None
        self.index_name = settings.pinecone_index or "luminal"

    async def initialize(self) -> None:
        from pinecone import Pinecone, ServerlessSpec
        pc = Pinecone(api_key=settings.pinecone_api_key)
        
        if self.index_name not in pc.list_indexes().names():
            pc.create_index(
                name=self.index_name,
                dimension=settings.embedding_dimension or 384,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
        self.index = pc.Index(self.index_name)

    async def add_documents(self, chunks: list[DocumentChunk]) -> list[str]:
        if not self.index:
            await self.initialize()
        
        vectors = []
        for chunk in chunks:
            vectors.append({
                "id": chunk.id,
                "values": chunk.embedding,
                "metadata": {**chunk.metadata, "content": chunk.content}
            })
        
        self.index.upsert(vectors=vectors)
        return [chunk.id for chunk in chunks]

    async def search(
        self,
        query_embedding: list[float],
        k: int = 5,
        filter_metadata: Optional[dict] = None
    ) -> list[DocumentChunk]:
        if not self.index:
            await self.initialize()
        
        results = self.index.query(
            vector=query_embedding,
            top_k=k,
            filter=filter_metadata,
            include_metadata=True
        )
        
        chunks = []
        for match in results.matches:
            metadata = match.metadata or {}
            content = metadata.pop("content", "")
            chunk = DocumentChunk(
                id=match.id,
                content=content,
                metadata=metadata,
                score=match.score
            )
            chunks.append(chunk)
        return chunks

    async def delete(self, ids: list[str]) -> bool:
        if not self.index:
            await self.initialize()
        self.index.delete(ids=ids)
        return True

    async def get_collection_stats(self) -> dict:
        if not self.index:
            await self.initialize()
        stats = self.index.describe_index_stats()
        return {"name": self.index_name, "count": stats.total_vector_count, "type": "pinecone"}


def init_pinecone():
    VectorStoreRegistry.register(PineconeVectorStore())