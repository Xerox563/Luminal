import uuid
import hashlib
import logging
from typing import List
from io import BytesIO
from app.services.embedding import EmbeddingService
from app.services.vector_store.base import DocumentChunk, VectorStoreRegistry
from app.core.config import settings

logger = logging.getLogger(__name__)


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
        if start >= len(text):
            break
    return chunks


def extract_text_from_pdf(file_content: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(BytesIO(file_content))
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text


def extract_text_from_docx(file_content: bytes) -> str:
    from docx import Document as DocxDocument
    doc = DocxDocument(BytesIO(file_content))
    text = ""
    for paragraph in doc.paragraphs:
        text += paragraph.text + "\n"
    return text


def extract_text_from_txt(file_content: bytes) -> str:
    return file_content.decode("utf-8")


def extract_text(file_content: bytes, filename: str) -> str:
    ext = filename.lower().split(".")[-1]
    if ext == "pdf":
        return extract_text_from_pdf(file_content)
    elif ext in ["docx"]:
        return extract_text_from_docx(file_content)
    elif ext in ["txt", "md"]:
        return extract_text_from_txt(file_content)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


async def ingest_document(
    file_content: bytes,
    filename: str,
    user_id: int,
    chunk_size: int = 1000,
    overlap: int = 200,
    metadata: dict = None
) -> dict:
    text = extract_text(file_content, filename)

    if not text.strip():
        raise ValueError("No text content could be extracted from the file")

    chunks_text = chunk_text(text, chunk_size, overlap)

    try:
        embeddings = EmbeddingService.embed_texts(chunks_text)
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        raise RuntimeError(f"Failed to generate embeddings: {e}")

    document_id = hashlib.sha256(f"{user_id}:{filename}".encode()).hexdigest()[:16]

    doc_chunks = []
    for i, (chunk_text_content, embedding) in enumerate(zip(chunks_text, embeddings)):
        chunk_id = hashlib.sha256(f"{user_id}:{filename}:{i}".encode()).hexdigest()[:16]
        chunk_metadata = {
            "user_id": user_id,
            "document_id": document_id,
            "filename": filename,
            "chunk_index": i,
            "total_chunks": len(chunks_text),
            "created_at": str(uuid.uuid4()),
            **(metadata or {})
        }
        chunk = DocumentChunk(
            id=chunk_id,
            content=chunk_text_content,
            metadata=chunk_metadata,
            embedding=embedding
        )
        doc_chunks.append(chunk)

    vector_store = VectorStoreRegistry.get(settings.vector_store)
    if not vector_store:
        vector_store = VectorStoreRegistry.get_default()

    if not vector_store:
        raise RuntimeError("No vector store available. Please configure Chroma or another vector store.")

    try:
        await vector_store.initialize()
        await vector_store.add_documents(doc_chunks)
    except Exception as e:
        logger.error(f"Vector store add_documents failed: {e}")
        raise RuntimeError(f"Failed to store documents: {e}")

    return {
        "document_id": document_id,
        "filename": filename,
        "chunks_created": len(doc_chunks),
        "total_characters": len(text)
    }
