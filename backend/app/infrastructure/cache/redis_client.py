import json
from typing import Any

import redis

from app.core.config import get_settings

EXTRACTION_QUEUE_KEY = "g4lms:jobs:kg_extraction"

_client: redis.Redis | None = None


def is_redis_enabled() -> bool:
    return bool(get_settings().redis_url.strip())


def get_redis() -> redis.Redis:
    global _client
    url = get_settings().redis_url.strip()
    if not url:
        raise RuntimeError("REDIS_URL is not configured.")
    if _client is None:
        _client = redis.Redis.from_url(url, decode_responses=True)
    return _client


def verify_redis_connectivity() -> bool:
    if not is_redis_enabled():
        return False
    return bool(get_redis().ping())


def cache_get_json(key: str) -> Any | None:
    if not is_redis_enabled():
        return None
    try:
        raw = get_redis().get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


def cache_set_json(key: str, value: Any, ttl_seconds: int = 3600) -> None:
    if not is_redis_enabled():
        return
    try:
        get_redis().setex(key, ttl_seconds, json.dumps(value, ensure_ascii=False))
    except Exception:
        pass


def cache_delete(key: str) -> None:
    if not is_redis_enabled():
        return
    try:
        get_redis().delete(key)
    except Exception:
        pass


def enqueue_extraction_job(payload: dict[str, Any]) -> None:
    get_redis().rpush(EXTRACTION_QUEUE_KEY, json.dumps(payload, ensure_ascii=False))


def dequeue_extraction_job(timeout_seconds: int = 5) -> dict[str, Any] | None:
    result = get_redis().blpop(EXTRACTION_QUEUE_KEY, timeout=timeout_seconds)
    if not result:
        return None
    _, raw = result
    return json.loads(raw)
