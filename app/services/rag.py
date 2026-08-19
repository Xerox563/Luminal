from typing import Optional, List
from dataclasses import dataclass
from app.services.retrieval import retrieve_for_rag, RetrievalResult
from app.services.vector_store.base import DocumentChunk
from app.core.config import settings


RAG_KEYWORDS = [
    "what is", "who is", "when did", "where is", "how to", "why does",
    "explain", "define", "describe", "tell me about", "information about",
    "details on", "background", "history of", "overview", "summary of",
    "according to", "based on", "reference", "document", "source",
    "lookup", "find", "search", "retrieve", "knowledge"
]


def needs_rag(prompt: str) -> bool:
    prompt_lower = prompt.lower()
    return any(keyword in prompt_lower for keyword in RAG_KEYWORDS)


@dataclass
class RAGResult:
    augmented_prompt: str
    retrieved_chunks: List[DocumentChunk]
    citations: List[dict]
    used_rag: bool
    citation_text: str = ""


async def inject_context(
    prompt: str,
    user_id: int,
    max_context_length: int = 4000
) -> RAGResult:
    if not needs_rag(prompt):
        return RAGResult(
            augmented_prompt=prompt,
            retrieved_chunks=[],
            citations=[],
            used_rag=False,
            citation_text=""
        )
    
    retrieval_result = await retrieve_for_rag(
        query=prompt,
        user_id=user_id,
        k=3,
        score_threshold=0.6
    )
    
    if not retrieval_result.chunks:
        return RAGResult(
            augmented_prompt=prompt,
            retrieved_chunks=[],
            citations=[],
            used_rag=False,
            citation_text=""
        )
    
    context_parts = []
    citations = []
    current_length = 0
    
    for i, chunk in enumerate(retrieval_result.chunks):
        chunk_text = f"[Source {i+1}: {chunk.metadata.get('filename', 'unknown')}]\n{chunk.content}\n"
        if current_length + len(chunk_text) > max_context_length:
            break
        context_parts.append(chunk_text)
        current_length += len(chunk_text)
        citations.append({
            "index": i + 1,
            "filename": chunk.metadata.get("filename", "unknown"),
            "chunk_index": chunk.metadata.get("chunk_index", 0),
            "score": chunk.score,
            "content_preview": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content
        })
    
    citation_text = ""
    if citations:
        citation_lines = ["\n\nSources:"]
        for c in citations:
            citation_lines.append(f"[{c['index']}] {c['filename']} (chunk {c['chunk_index']}, relevance: {c['score']:.2f})")
        citation_text = "\n".join(citation_lines)
    
    if context_parts:
        context = "\n".join(context_parts)
        augmented_prompt = f"""Use the following context to answer the question. If the context doesn't contain relevant information, answer based on your knowledge.

Context:
{context}

Question: {prompt}

Answer:"""
    else:
        augmented_prompt = prompt
    
    return RAGResult(
        augmented_prompt=augmented_prompt,
        retrieved_chunks=retrieval_result.chunks,
        citations=citations,
        used_rag=bool(context_parts),
        citation_text=citation_text
    )


def format_response_with_citations(content: str, citation_text: str) -> str:
    if not citation_text:
        return content
    return content + citation_text