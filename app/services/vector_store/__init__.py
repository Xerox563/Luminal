from app.services.vector_store.base import VectorStoreRegistry
from app.services.vector_store.chroma import init_chroma
from app.services.vector_store.pinecone import init_pinecone
from app.services.vector_store.weaviate import init_weaviate


def init_vector_stores():
    init_chroma()
    try:
        init_pinecone()
    except Exception:
        pass
    try:
        init_weaviate()
    except Exception:
        pass