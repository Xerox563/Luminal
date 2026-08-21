from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import json
import traceback
import logging
from datetime import datetime
from app.db.session import get_db
from app.services.auth import get_current_user
from app.services.ingestion import ingest_document
from app.services.vector_store.base import VectorStoreRegistry
from app.core.config import settings
from app.models import User
from app.schemas.document import DocumentIngestResponse, DocumentListResponse, DocumentInfo, DocumentDeleteRequest

logger = logging.getLogger(__name__)
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
    try:
        file_content = await file.read()

        if not file_content:
            raise HTTPException(status_code=400, detail="File is empty")

        meta = json.loads(metadata) if metadata else {}

        result = await ingest_document(
            file_content=file_content,
            filename=file.filename or "unknown.txt",
            user_id=current_user.id,
            chunk_size=chunk_size,
            overlap=overlap,
            metadata=meta
        )

        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Document upload failed: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    vector_store = VectorStoreRegistry.get(settings.vector_store)
    if not vector_store:
        vector_store = VectorStoreRegistry.get_default()

    try:
        docs = await vector_store.list_documents(current_user.id)
        return DocumentListResponse(documents=docs, total=len(docs))
    except Exception:
        return DocumentListResponse(documents=[], total=0)


@router.get("/{document_id}", response_model=DocumentInfo)
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    vector_store = VectorStoreRegistry.get(settings.vector_store)
    if not vector_store:
        vector_store = VectorStoreRegistry.get_default()

    if vector_store:
        docs = await vector_store.list_documents(current_user.id)
        for doc in docs:
            if doc.get("id") == document_id or doc.get("filename") == document_id:
                created_at = doc.get("created_at")
                if isinstance(created_at, str) and created_at:
                    try:
                        created_at = datetime.fromisoformat(created_at)
                    except Exception:
                        created_at = datetime.utcnow()
                elif not created_at:
                    created_at = datetime.utcnow()
                return DocumentInfo(
                    document_id=doc.get("id", document_id),
                    filename=doc.get("filename", document_id),
                    chunks_count=doc.get("chunks_count", 0),
                    created_at=created_at
                )
    
    raise HTTPException(status_code=404, detail="Document not found")


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
