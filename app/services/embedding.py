from typing import Optional
from sentence_transformers import SentenceTransformer
import numpy as np
from app.core.config import settings


class EmbeddingService:
    _model: Optional[SentenceTransformer] = None
    _model_name = "all-MiniLM-L6-v2"

    @classmethod
    def get_model(cls) -> SentenceTransformer:
        if cls._model is None:
            cls._model = SentenceTransformer(cls._model_name)
        return cls._model

    @classmethod
    def embed_text(cls, text: str) -> list[float]:
        model = cls.get_model()
        embedding = model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    @classmethod
    def embed_texts(cls, texts: list[str]) -> list[list[float]]:
        model = cls.get_model()
        embeddings = model.encode(texts, convert_to_numpy=True)
        return embeddings.tolist()

    @classmethod
    def get_dimension(cls) -> int:
        return 384