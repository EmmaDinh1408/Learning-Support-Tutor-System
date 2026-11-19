import hashlib
import json
import re
from typing import Any

import httpx

from app.core.config import get_settings
from app.infrastructure.cache.redis_client import cache_get_json, cache_set_json


def _prompt_cache_key(prefix: str, text: str) -> str:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return f"g4lms:llm:{prefix}:{digest}"


def _extract_json_block(raw: str) -> dict[str, Any] | None:
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def _call_gemini(prompt: str) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.gemini_api_key.strip():
        return None
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.llm_model}:generateContent?key={settings.gemini_api_key.strip()}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }
    try:
        with httpx.Client(timeout=45.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return _extract_json_block(text)
    except Exception:
        return None


def _call_openai(prompt: str) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.openai_api_key.strip():
        return None
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {settings.openai_api_key.strip()}"}
    payload = {
        "model": settings.llm_model if "gpt" in settings.llm_model else "gpt-4o-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "You extract structured curriculum Knowledge Graphs as strict JSON."},
            {"role": "user", "content": prompt},
        ],
    }
    try:
        with httpx.Client(timeout=45.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"]
            return _extract_json_block(text)
    except Exception:
        return None


def _deterministic_fallback(course_title: str, chunks: list[str]) -> dict[str, Any]:
    """Fallback extractor when external LLM key is absent or unavailable."""
    combined = "\n".join(chunks)
    lines = [line.strip(" -•*\t\r") for line in combined.splitlines() if 6 <= len(line.strip()) <= 90]
    candidate_topics: list[str] = []
    seen = set()
    for line in lines:
        cleaned = re.sub(r"^(chương|bài|chapter|unit|section)\s*\d*[:.\-]?\s*", "", line, flags=re.IGNORECASE).strip()
        if len(cleaned) >= 5 and cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            candidate_topics.append(cleaned)
        if len(candidate_topics) >= 6:
            break

    if len(candidate_topics) < 3:
        candidate_topics = [
            f"Tổng quan & Kiến trúc cơ bản ({course_title})",
            f"Nguyên lý & Thuật toán cốt lõi ({course_title})",
            f"Phân tích & Ứng dụng thực tiễn ({course_title})",
        ]

    los = [
        {"code": "L.O.1", "name": f"Nắm vững nền tảng lý thuyết của {course_title}"},
        {"code": "L.O.2", "name": f"Phân tích và vận dụng kiến thức {course_title} vào bài toán thực tế"},
    ]
    concepts = []
    edges = []
    for idx, topic in enumerate(candidate_topics):
        lo_code = "L.O.1" if idx < max(1, len(candidate_topics) // 2) else "L.O.2"
        concepts.append(
            {
                "key": f"c{idx + 1}",
                "name": topic,
                "chapter_id": f"ch{(idx // 2) + 1}",
                "description": f"Khái niệm trích xuất từ tài liệu môn {course_title}.",
                "lo_code": lo_code,
            }
        )
        if idx > 0:
            edges.append(
                {
                    "source_key": f"c{idx}",
                    "target_key": f"c{idx + 1}",
                    "type": "PREREQUISITE",
                    "confidence": 0.78,
                }
            )
    return {"learning_outcomes": los, "concepts": concepts, "edges": edges, "provider": "fallback"}


def extract_knowledge_graph_from_chunks(course_id: str, course_title: str, chunks: list[str]) -> dict[str, Any]:
    """AI Gateway entry point: checks Redis LLM cache, calls External LLM, falls back deterministically."""
    settings = get_settings()
    excerpt = "\n---\n".join(chunks[:8])[:12000]
    prompt = (
        f"Course: {course_title} ({course_id}).\n"
        "Extract a Knowledge Graph JSON with keys:\n"
        "- learning_outcomes: [{code, name}]\n"
        "- concepts: [{key, name, chapter_id, description, lo_code}]\n"
        "- edges: [{source_key, target_key, type ('PREREQUISITE'|'PART_OF'|'RELATED_TO'), confidence (0..1)}]\n"
        f"Source material:\n{excerpt}"
    )
    cache_key = _prompt_cache_key("kg_extract", prompt)
    cached = cache_get_json(cache_key)
    if cached:
        return cached

    result: dict[str, Any] | None = None
    if settings.llm_provider.lower() == "openai":
        result = _call_openai(prompt) or _call_gemini(prompt)
    else:
        result = _call_gemini(prompt) or _call_openai(prompt)

    if result and isinstance(result.get("concepts"), list) and result["concepts"]:
        result["provider"] = settings.llm_provider
    else:
        result = _deterministic_fallback(course_title, chunks)

    cache_set_json(cache_key, result, ttl_seconds=settings.llm_cache_ttl_seconds)
    return result
