from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import numpy as np
from flask import current_app
from sentence_transformers import SentenceTransformer

from ..mongo import class_materials_col


def _utcnow():
    return datetime.now(timezone.utc)


def _sha1(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()


def _chunk_text(text: str, *, chunk_size: int = 900, overlap: int = 150) -> list[str]:
    t = (text or "").strip()
    if not t:
        return []
    t = " ".join(t.split())  # normalize whitespace
    chunks: list[str] = []
    i = 0
    while i < len(t):
        j = min(len(t), i + chunk_size)
        chunk = t[i:j].strip()
        if chunk:
            chunks.append(chunk)
        if j == len(t):
            break
        i = max(0, j - overlap)
    return chunks


@dataclass(frozen=True)
class RagChunk:
    chunk_id: str
    text: str
    title: str
    source_url: str
    kind: str


@lru_cache(maxsize=1)
def _embedder() -> SentenceTransformer:
    model_name = current_app.config.get("EMBEDDING_MODEL") or "all-MiniLM-L6-v2"
    return SentenceTransformer(model_name)


def _data_dir_for_class(classroom_id: str) -> str:
    base = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "rag")
    return os.path.join(base, classroom_id)


def _paths(classroom_id: str) -> dict[str, str]:
    d = _data_dir_for_class(classroom_id)
    return {
        "dir": d,
        "vectors": os.path.join(d, "vectors.npy"),
        "meta": os.path.join(d, "chunks.json"),
    }


def upsert_material(
    *,
    classroom_id: str,
    kind: str,
    title: str,
    source_url: str,
    extracted_text: str,
) -> str:
    """
    Stores/updates a material document in Mongo and returns its id as string.
    """
    chunks = _chunk_text(extracted_text)
    chunk_docs = [{"chunk_id": f"{_sha1(c)[:12]}", "text": c, "hash": _sha1(c)} for c in chunks]

    doc = {
        "classroom_id": classroom_id,
        "kind": kind,
        "title": title,
        "source_url": source_url,
        "text": extracted_text,
        "chunks": chunk_docs,
        "updated_at": _utcnow(),
    }

    existing = class_materials_col().find_one(
        {"classroom_id": classroom_id, "source_url": source_url, "kind": kind},
        {"_id": 1},
    )
    if existing:
        class_materials_col().update_one({"_id": existing["_id"]}, {"$set": doc})
        return str(existing["_id"])

    doc["created_at"] = _utcnow()
    res = class_materials_col().insert_one(doc)
    return str(res.inserted_id)


def rebuild_index(classroom_id: str) -> int:
    """
    Builds (or rebuilds) vectors.npy + chunks.json for a classroom.
    Returns number of chunks indexed.
    """
    rows = list(
        class_materials_col().find({"classroom_id": classroom_id}, {"kind": 1, "title": 1, "source_url": 1, "chunks": 1})
    )
    all_chunks: list[RagChunk] = []
    for r in rows:
        for ch in (r.get("chunks") or []):
            all_chunks.append(
                RagChunk(
                    chunk_id=str(ch.get("chunk_id") or ""),
                    text=str(ch.get("text") or ""),
                    title=str(r.get("title") or ""),
                    source_url=str(r.get("source_url") or ""),
                    kind=str(r.get("kind") or ""),
                )
            )

    all_chunks = [c for c in all_chunks if c.chunk_id and c.text]
    if not all_chunks:
        # Ensure directory exists and write empty files for consistent behavior
        p = _paths(classroom_id)
        os.makedirs(p["dir"], exist_ok=True)
        np.save(p["vectors"], np.zeros((0, 384), dtype=np.float32))
        with open(p["meta"], "w", encoding="utf-8") as f:
            json.dump({"chunks": []}, f)
        return 0

    texts = [c.text for c in all_chunks]
    emb = _embedder().encode(texts, normalize_embeddings=True, convert_to_numpy=True)
    vectors = emb.astype(np.float32)

    p = _paths(classroom_id)
    os.makedirs(p["dir"], exist_ok=True)
    np.save(p["vectors"], vectors)
    with open(p["meta"], "w", encoding="utf-8") as f:
        json.dump(
            {
                "chunks": [
                    {
                        "chunk_id": c.chunk_id,
                        "text": c.text,
                        "title": c.title,
                        "source_url": c.source_url,
                        "kind": c.kind,
                    }
                    for c in all_chunks
                ]
            },
            f,
        )
    return len(all_chunks)


def _load_index(classroom_id: str) -> tuple[np.ndarray, list[dict[str, Any]]]:
    p = _paths(classroom_id)
    if not os.path.exists(p["vectors"]) or not os.path.exists(p["meta"]):
        return np.zeros((0, 384), dtype=np.float32), []

    vectors = np.load(p["vectors"])
    with open(p["meta"], "r", encoding="utf-8") as f:
        meta = json.load(f)
    chunks = list(meta.get("chunks") or [])
    return vectors.astype(np.float32), chunks


def retrieve(*, classroom_id: str, query: str, k: int = 5) -> list[dict[str, Any]]:
    """
    Returns top-k chunk dicts with similarity scores.
    Uses cosine similarity on normalized embeddings.
    """
    vectors, chunks = _load_index(classroom_id)
    if vectors.shape[0] == 0 or not chunks:
        return []

    qv = _embedder().encode([query], normalize_embeddings=True, convert_to_numpy=True).astype(np.float32)[0]
    # cosine similarity because vectors are normalized
    sims = vectors @ qv
    idx = np.argsort(-sims)[: min(k, len(sims))]

    out: list[dict[str, Any]] = []
    for i in idx:
        ch = chunks[int(i)]
        out.append(
            {
                "chunk_id": ch.get("chunk_id"),
                "text": ch.get("text"),
                "title": ch.get("title"),
                "source_url": ch.get("source_url"),
                "kind": ch.get("kind"),
                "score": float(sims[int(i)]),
            }
        )
    return out

