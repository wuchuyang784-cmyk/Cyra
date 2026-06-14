from __future__ import annotations

import hashlib
import time
from pathlib import Path
from typing import Any

from app.core.config import get_settings


COLLECTION_NAME = "cyra_knowledge"
EMBEDDING_BATCH_SIZE = 10
EMBEDDING_MAX_ATTEMPTS = 3
VECTOR_MAX_DISTANCE = 0.9


def index_resource_pack(chunks: list[dict[str, str]]) -> None:
    if not chunks:
        return
    collection = _collection()
    ids = [_chunk_id(chunk) for chunk in chunks]
    documents = [_embedding_document(chunk) for chunk in chunks]
    metadatas = [_metadata(chunk) for chunk in chunks]
    embeddings = _embed_texts(documents, text_type="document")
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas, embeddings=embeddings)


def delete_resource_chunks(chunks: list[dict[str, str]]) -> None:
    if not chunks:
        return
    collection = _collection()
    collection.delete(ids=[_chunk_id(chunk) for chunk in chunks])


def reset_resource_index(chunks: list[dict[str, str]]) -> None:
    if not chunks:
        return
    ids = [_chunk_id(chunk) for chunk in chunks]
    documents = [_embedding_document(chunk) for chunk in chunks]
    metadatas = [_metadata(chunk) for chunk in chunks]
    embeddings = _embed_texts(documents, text_type="document")

    settings = get_settings()
    persist_dir = Path(settings.chroma_persist_dir)
    if not persist_dir.is_absolute():
        persist_dir = Path(__file__).resolve().parents[4] / persist_dir
    persist_dir.mkdir(parents=True, exist_ok=True)

    import chromadb

    client = chromadb.PersistentClient(path=str(persist_dir))
    try:
        client.delete_collection(name=COLLECTION_NAME)
    except Exception:
        pass
    collection = client.get_or_create_collection(name=COLLECTION_NAME)
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas, embeddings=embeddings)


def vector_context_for(query: str, limit: int = 4) -> tuple[str, list[dict[str, str]]]:
    clean_query = query.strip()
    if not clean_query:
        return "", []
    collection = _collection()
    query_embedding = _embed_texts([clean_query], text_type="query")[0]
    result = collection.query(query_embeddings=[query_embedding], n_results=limit)
    documents = result.get("documents", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]
    blocks: list[str] = []
    sources: list[dict[str, str]] = []
    for document, metadata, distance in zip(documents, metadatas, distances):
        if document is None or metadata is None:
            continue
        if _is_low_confidence_distance(distance):
            continue
        title = str(metadata.get("title") or "知识片段")
        source = str(metadata.get("source") or "ChromaDB")
        index = len(blocks) + 1
        blocks.append(f"[资料{index}] {title}\n{document}")
        sources.append(
            {
                "id": str(metadata.get("chunk_id") or ""),
                "title": title,
                "source": source,
                "distance": str(distance),
            }
        )
    return "\n\n".join(blocks), sources


def _is_low_confidence_distance(distance: object) -> bool:
    if distance is None:
        return False
    try:
        return float(distance) > VECTOR_MAX_DISTANCE
    except (TypeError, ValueError):
        return False


def _collection() -> Any:
    import chromadb

    settings = get_settings()
    persist_dir = Path(settings.chroma_persist_dir)
    if not persist_dir.is_absolute():
        persist_dir = Path(__file__).resolve().parents[4] / persist_dir
    persist_dir.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(persist_dir))
    return client.get_or_create_collection(name=COLLECTION_NAME)


def _embed_texts(texts: list[str], text_type: str) -> list[list[float]]:
    from dashscope import TextEmbedding

    settings = get_settings()
    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY is required for ChromaDB vector RAG embeddings")
    embeddings: list[list[float]] = []
    for start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
        batch = texts[start : start + EMBEDDING_BATCH_SIZE]
        response = None
        last_error: Exception | None = None
        for attempt in range(EMBEDDING_MAX_ATTEMPTS):
            try:
                response = TextEmbedding.call(**_embedding_call_kwargs(batch, text_type))
                break
            except Exception as error:
                last_error = error
                if attempt < EMBEDDING_MAX_ATTEMPTS - 1:
                    time.sleep(0.8 * (attempt + 1))
        if response is None:
            raise RuntimeError(f"DashScope embedding request failed after retries: {last_error}") from last_error
        if response.status_code != 200:
            message = getattr(response, "message", "DashScope embedding request failed")
            raise RuntimeError(str(message))
        output = response.output or {}
        items = output.get("embeddings", [])
        embeddings.extend([item["embedding"] for item in sorted(items, key=lambda item: item["text_index"])])
    return embeddings


def _embedding_call_kwargs(batch: list[str], text_type: str) -> dict[str, Any]:
    settings = get_settings()
    kwargs: dict[str, Any] = {
        "api_key": settings.dashscope_api_key,
        "model": settings.dashscope_embedding_model,
        "input": batch,
        "text_type": text_type,
    }
    if settings.dashscope_embedding_model == "text-embedding-v2":
        return kwargs
    kwargs["dimension"] = settings.dashscope_embedding_dimension
    kwargs["output_type"] = "dense"
    return kwargs


def _chunk_id(chunk: dict[str, str]) -> str:
    digest = hashlib.sha1(
        f"{chunk['id']}|{chunk['source']}|{chunk['title']}|{chunk['content']}".encode("utf-8")
    ).hexdigest()
    return f"cyra-{digest}"


def _embedding_document(chunk: dict[str, str]) -> str:
    title = (chunk.get("title") or "").strip()
    content = (chunk.get("content") or "").strip()
    return f"{title}\n{content}".strip()


def _metadata(chunk: dict[str, str]) -> dict[str, str]:
    return {
        "chunk_id": chunk["id"],
        "title": chunk["title"],
        "source": chunk["source"],
    }
