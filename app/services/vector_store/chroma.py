import chromadb
from chromadb.config import Settings
from typing import Optional
from app.services.vector_store.base import VectorStore, DocumentChunk, VectorStoreRegistry
from app.core.config import settings


class ChromaVectorStore(VectorStore):
    @property
    def name(self) -> str:
        return "chroma"

    def __init__(self):
        self.client: Optional[chromadb.Client] = None
        self.collection = None
        self.collection_name = "luminal_documents"

    async def initialize(self) -> None:
        self.client = chromadb.HttpClient(
            host=settings.chroma_host or "localhost",
            port=settings.chroma_port or 8000,
            settings=Settings(anonymized_telemetry=False)
        )
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )

    async def add_documents(self, chunks: list[DocumentChunk]) -> list[str]:
        if not self.collection:
            await self.initialize()
        
        ids = [chunk.id for chunk in chunks]
        documents = [chunk.content for chunk in chunks]
        embeddings = [chunk.embedding for chunk in chunks]
        metadatas = [chunk.metadata for chunk in chunks]
        
        self.collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )
        return ids

    async def search(
        self,
        query_embedding: list[float],
        k: int = 5,
        filter_metadata: Optional[dict] = None
    ) -> list[DocumentChunk]:
        if not self.collection:
            await self.initialize()
        
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=k,
            where=filter_metadata,
            include=["documents", "metadatas", "distances"]
        )
        
        chunks = []
        if results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                chunk = DocumentChunk(
                    id=doc_id,
                    content=results["documents"][0][i],
                    metadata=results["metadatas"][0][i],
                    score=1.0 - results["distances"][0][i] if results["distances"][0] else None
                )
                chunks.append(chunk)
        return chunks

    async def delete(self, ids: list[str]) -> bool:
        if not self.collection:
            await self.initialize()
        self.collection.delete(ids=ids)
        return True

    async def get_collection_stats(self) -> dict:
        if not self.collection:
            await self.initialize()
        count = self.collection.count()
        return {"name": self.collection_name, "count": count, "type": "chroma"}


def init_chroma():
    VectorStoreRegistry.register(ChromaVectorStore())