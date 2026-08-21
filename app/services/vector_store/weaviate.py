from typing import Optional
from app.services.vector_store.base import VectorStore, DocumentChunk, VectorStoreRegistry
from app.core.config import settings


class WeaviateVectorStore(VectorStore):
    @property
    def name(self) -> str:
        return "weaviate"

    def __init__(self):
        self.client = None
        self.class_name = "LuminalDocument"

    async def initialize(self) -> None:
        import weaviate
        self.client = weaviate.Client(
            url=settings.weaviate_url or "http://localhost:8080",
            auth_client_secret=weaviate.AuthApiKey(api_key=settings.weaviate_api_key) if settings.weaviate_api_key else None
        )
        
        if not self.client.schema.exists(self.class_name):
            class_obj = {
                "class": self.class_name,
                "vectorizer": "none",
                "properties": [
                    {"name": "content", "dataType": ["text"]},
                    {"name": "metadata", "dataType": ["object"]}
                ]
            }
            self.client.schema.create_class(class_obj)

    async def add_documents(self, chunks: list[DocumentChunk]) -> list[str]:
        if not self.client:
            await self.initialize()
        
        ids = []
        with self.client.batch as batch:
            batch.batch_size = 100
            for chunk in chunks:
                data_object = {
                    "content": chunk.content,
                    "metadata": chunk.metadata
                }
                batch.add_data_object(
                    data_object=data_object,
                    class_name=self.class_name,
                    uuid=chunk.id,
                    vector=chunk.embedding
                )
                ids.append(chunk.id)
        return ids

    async def search(
        self,
        query_embedding: list[float],
        k: int = 5,
        filter_metadata: Optional[dict] = None
    ) -> list[DocumentChunk]:
        if not self.client:
            await self.initialize()
        
        near_vector = {"vector": query_embedding}
        where_filter = None
        if filter_metadata:
            where_filter = {"operator": "And", "operands": [
                {"path": ["metadata", k], "operator": "Equal", "valueText": v}
                for k, v in filter_metadata.items()
            ]}
        
        result = self.client.query.get(
            self.class_name, ["content", "metadata"]
        ).with_near_vector(near_vector).with_limit(k).with_additional(["certainty"]).do()
        
        chunks = []
        if result.get("data", {}).get("Get", {}).get(self.class_name):
            for item in result["data"]["Get"][self.class_name]:
                additional = item.get("_additional", {})
                chunk = DocumentChunk(
                    id=additional.get("id", ""),
                    content=item.get("content", ""),
                    metadata=item.get("metadata", {}),
                    score=additional.get("certainty")
                )
                chunks.append(chunk)
        return chunks

    async def delete(self, ids: list[str]) -> bool:
        if not self.client:
            await self.initialize()
        for id in ids:
            self.client.data_object.delete(uuid=id, class_name=self.class_name)
        return True

    async def list_documents(self, user_id: int) -> list[dict]:
        return []

    async def get_collection_stats(self) -> dict:
        if not self.client:
            await self.initialize()
        result = self.client.query.aggregate(self.class_name).with_meta_count().do()
        count = result.get("data", {}).get("Aggregate", {}).get(self.class_name, [{}])[0].get("meta", {}).get("count", 0)
        return {"name": self.class_name, "count": count, "type": "weaviate"}


def init_weaviate():
    VectorStoreRegistry.register(WeaviateVectorStore())