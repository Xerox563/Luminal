from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import json
from app.db.session import get_db
from app.services.auth import get_current_user
from app.services.ingestion import ingest_document
from app.services.vector_store.base import VectorStoreRegistry
from app.core.config import settings
from app.models import User
from app.schemas.document import DocumentIngestResponse, DocumentListResponse, DocumentInfo, DocumentDeleteRequest

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentIngestResponse)
async def upload_document(
    file: UploadFile = File(...),
    metadata: Optional[str] = Form(None),
    chunk_size: int = Form(1000),
    overlap: int = Form(200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    file_content = await file.read()
    
    meta = json.loads(metadata) if metadata else {}
    
    result = await ingest_document(
        file_content=file_content,
        filename=file.filename,
        user_id=current_user.id,
        chunk_size=chunk_size,
        overlap=overlap,
        metadata=meta
    )
    
    return result


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    vector_store = VectorStoreRegistry.get(settings.vector_store)
    if not vector_store:
        vector_store = VectorStoreRegistry.get_default()
    
    stats = await vector_store.get_collection_stats() if vector_store else {"count": 0}
    
    return DocumentListResponse(documents=[], total=stats.get("count", 0))


@router.get("/{document_id}", response_model=DocumentInfo)
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return DocumentInfo(
        document_id=document_id,
        filename="unknown",
        chunks_count=0,
        created_at=datetime.utcnow()
    )


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    vector_store = VectorStoreRegistry.get(settings.vector_store)
    if not vector_store:
        vector_store = VectorStoreRegistry.get_default()
    
    if vector_store:
        await vector_store.delete([document_id])
    
    return {"message": "Document deleted"}


@router.post("/delete-batch")
async def delete_documents_batch(
    request: DocumentDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    vector_store = VectorStoreRegistry.get(settings.vector_store)
    if not vector_store:
        vector_store = VectorStoreRegistry.get_default()
    
    if vector_store:
        await vector_store.delete(request.document_ids)
    
    return {"message": f"Deleted {len(request.document_ids)} documents"}


from datetime import datetime