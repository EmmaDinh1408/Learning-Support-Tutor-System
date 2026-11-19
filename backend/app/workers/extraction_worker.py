"""Document & KG Extraction Worker.

Consumes jobs from Redis queue -> reads PDF from MinIO/S3 -> chunks text ->
calls AI Gateway (LLM + Cache + Fallback) -> writes doc_chunk, ai_proposal_item,
and outbox_events transactionally into PostgreSQL.
"""

import io
import json
import logging
import time
from typing import Any

from pypdf import PdfReader
from ulid import ULID

from app.infrastructure.ai_gateway import extract_knowledge_graph_from_chunks
from app.infrastructure.cache.redis_client import dequeue_extraction_job
from app.infrastructure.neo4j.driver import verify_connectivity
from app.infrastructure.postgres.db import ensure_postgres_schema, is_postgres_enabled, pg_conn
from app.infrastructure.storage.minio_client import get_object_bytes

logging.basicConfig(level=logging.INFO, format="[ExtractionWorker] %(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages = [page.extract_text() or "" for page in reader.pages[:40]]
        return "\n".join(pages).strip()
    except Exception:
        return ""


def _chunk_text(text: str, chunk_size: int = 1000, overlap: int = 150) -> list[str]:
    if not text.strip():
        return []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(start + 1, end - overlap)
    return [c for c in chunks if c]


def process_extraction_job(job: dict[str, Any]) -> dict[str, Any]:
    job_id = str(job["job_id"])
    course_id = str(job["course_id"])
    course_title = str(job.get("course_title") or course_id)
    document_id = job.get("document_id")
    s3_key = job.get("s3_key")

    logger.info("Processing KG extraction job %s for course %s", job_id, course_id)

    if is_postgres_enabled():
        with pg_conn() as conn:
            conn.execute(
                "UPDATE kg_extraction_jobs SET status = 'processing', updated_at = NOW() WHERE id = %s",
                (job_id,),
            )

    raw_text = ""
    if s3_key:
        try:
            pdf_bytes = get_object_bytes(str(s3_key))
            raw_text = _extract_pdf_text(pdf_bytes)
        except Exception as exc:
            logger.warning("Could not read object %s: %s", s3_key, exc)

    chunks = _chunk_text(raw_text) or [f"Khóa học {course_title} ({course_id})"]
    extracted = extract_knowledge_graph_from_chunks(course_id, course_title, chunks)

    lo_nodes: list[dict[str, Any]] = []
    lo_id_by_code: dict[str, str] = {}
    for idx, lo in enumerate(extracted.get("learning_outcomes", [])[:8], start=1):
        ulid_str = str(ULID())
        code = str(lo.get("code") or f"L.O.{idx}")
        node_id = f"{course_id}.{code.replace('.', '')}"
        lo_id_by_code[code] = node_id
        lo_nodes.append(
            {
                "ulid": ulid_str,
                "id": node_id,
                "code": code,
                "name": str(lo.get("name") or f"Chuẩn đầu ra {idx}"),
                "nodeType": "LO",
                "sequence": idx,
                "status": "approved",
            }
        )

    concept_nodes: list[dict[str, Any]] = []
    concept_id_by_key: dict[str, str] = {}
    edges: list[dict[str, Any]] = []

    for idx, concept in enumerate(extracted.get("concepts", [])[:20], start=1):
        ulid_str = str(ULID())
        key = str(concept.get("key") or f"c{idx}")
        node_id = f"{course_id}_{key}"
        concept_id_by_key[key] = node_id
        concept_nodes.append(
            {
                "ulid": ulid_str,
                "id": node_id,
                "name": str(concept.get("name") or f"Khái niệm {idx}"),
                "description": str(concept.get("description") or ""),
                "chapter_id": str(concept.get("chapter_id") or f"ch{((idx - 1) // 2) + 1}"),
                "nodeType": "Concept",
                "sequence": idx,
                "status": "proposed",
            }
        )
        lo_code = str(concept.get("lo_code") or "")
        target_lo = lo_id_by_code.get(lo_code) or (lo_nodes[0]["id"] if lo_nodes else None)
        if target_lo:
            edges.append(
                {
                    "ulid": str(ULID()),
                    "source": node_id,
                    "target": target_lo,
                    "type": "DEVELOP",
                    "status": "proposed",
                    "confidence": 0.85,
                }
            )

    for edge in extracted.get("edges", []):
        src = concept_id_by_key.get(str(edge.get("source_key") or ""))
        tgt = concept_id_by_key.get(str(edge.get("target_key") or ""))
        if src and tgt and src != tgt:
            edges.append(
                {
                    "ulid": str(ULID()),
                    "source": src,
                    "target": tgt,
                    "type": str(edge.get("type") or "PREREQUISITE"),
                    "status": "proposed",
                    "confidence": float(edge.get("confidence") or 0.78),
                }
            )

    all_nodes = lo_nodes + concept_nodes
    outbox_payload = {
        "job_id": job_id,
        "course_id": course_id,
        "nodes": all_nodes,
        "edges": edges,
    }

    if is_postgres_enabled():
        with pg_conn() as conn:
            for c_idx, chunk_text in enumerate(chunks):
                conn.execute(
                    """
                    INSERT INTO doc_chunk (id, course_id, document_id, chunk_index, content, token_estimate)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (str(ULID()), course_id, document_id, c_idx, chunk_text, len(chunk_text.split())),
                )

            for node in all_nodes:
                conn.execute(
                    """
                    INSERT INTO ai_proposal_item (id, job_id, course_id, item_kind, ulid, payload, status)
                    VALUES (%s, %s, %s, 'node', %s, %s::jsonb, %s)
                    """,
                    (str(ULID()), job_id, course_id, node["ulid"], json.dumps(node), node["status"]),
                )

            for edge in edges:
                conn.execute(
                    """
                    INSERT INTO ai_proposal_item (id, job_id, course_id, item_kind, ulid, payload, status)
                    VALUES (%s, %s, %s, 'edge', %s, %s::jsonb, %s)
                    """,
                    (str(ULID()), job_id, course_id, edge["ulid"], json.dumps(edge), edge["status"]),
                )

            conn.execute(
                """
                INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status)
                VALUES (%s, 'CourseKnowledgeGraph', %s, 'KG_PROPOSAL_CREATED', %s::jsonb, 'pending')
                """,
                (str(ULID()), course_id, json.dumps(outbox_payload)),
            )

            conn.execute(
                """
                UPDATE kg_extraction_jobs
                SET status = 'syncing', nodes_created = %s, edges_created = %s, updated_at = NOW()
                WHERE id = %s
                """,
                (len(all_nodes), len(edges), job_id),
            )

    logger.info("Job %s extracted %d nodes, %d edges -> outbox queued", job_id, len(all_nodes), len(edges))
    return outbox_payload


def run_worker_loop() -> None:
    verify_connectivity()
    ensure_postgres_schema()
    logger.info("Document & KG Extraction Worker started, listening on Redis queue...")
    while True:
        try:
            job = dequeue_extraction_job(timeout_seconds=5)
            if not job:
                continue
            try:
                process_extraction_job(job)
            except Exception as exc:
                logger.exception("Extraction job failed: %s", exc)
                if is_postgres_enabled() and job.get("job_id"):
                    with pg_conn() as conn:
                        conn.execute(
                            "UPDATE kg_extraction_jobs SET status = 'failed', error_message = %s, updated_at = NOW() WHERE id = %s",
                            (str(exc), str(job["job_id"])),
                        )
        except Exception as exc:
            logger.error("Worker loop error: %s", exc)
            time.sleep(2)


if __name__ == "__main__":
    run_worker_loop()
