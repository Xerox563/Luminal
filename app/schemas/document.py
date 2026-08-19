from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class DocumentIngestResponse(BaseModel):
    document_id: str
    filename: str
    chunks_created: int
    total_characters: int


class DocumentInfo(BaseModel):
    document_id: str
    filename: str
    chunks_count: int
    created_at: datetime
    metadata: dict = {}


class DocumentListResponse(BaseModel):
    documents: List[DocumentInfo]
    total: int


class DocumentDeleteRequest(BaseModel):
    document_ids: List[str] = Field(..., min_length=1)