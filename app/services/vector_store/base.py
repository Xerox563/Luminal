from abc import ABC, abstractmethod
from typing import Optional
from dataclasses import dataclass


@dataclass
class DocumentChunk:
    id: str
    content: str
    metadata: dict
    embedding: Optional[list[float]] = None
    score: Optional[float] = None


class VectorStore(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    async def initialize(self) -> None:
        pass

    @abstractmethod
    async def add_documents(self, chunks: list[DocumentChunk]) -> list[str]:
        pass

    @abstractmethod
    async def search(
        self,
        query_embedding: list[float],
        k: int = 5,
        filter_metadata: Optional[dict] = None
    ) -> list[DocumentChunk]:
        pass

    @abstractmethod
    async def delete(self, ids: list[str]) -> bool:
        pass

    @abstractmethod
    async def get_collection_stats(self) -> dict:
        pass


class VectorStoreRegistry:
    _stores: dict[str, VectorStore] = {}

    @classmethod
    def register(cls, store: VectorStore) -> None:
        cls._stores[store.name] = store

    @classmethod
    def get(cls, name: str) -> Optional[VectorStore]:
        return cls._stores.get(name)

    @classmethod
    def get_default(cls) -> Optional[VectorStore]:
        return next(iter(cls._stores.values())) if cls._stores else None