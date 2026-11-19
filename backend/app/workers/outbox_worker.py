"""Outbox Sync Worker.

Polls unprocessed events from PostgreSQL outbox_events -> executes idempotent
Cypher MERGE 1-1 by ULID into Neo4j -> marks events processed and invalidates Redis cache.
"""

import logging
import time
from typing import Any

from app.infrastructure.cache.redis_client import cache_delete
from app.infrastructure.neo4j.driver import run_write, verify_connectivity
from app.infrastructure.postgres.db import ensure_postgres_schema, is_postgres_enabled, pg_conn

logging.basicConfig(level=logging.INFO, format="[OutboxSyncWorker] %(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def sync_kg_payload_to_neo4j(payload: dict[str, Any]) -> None:
    """Idempotent Cypher MERGE 1-1 using ULID for nodes and relationships."""
    course_id = str(payload["course_id"])
    nodes: list[dict[str, Any]] = payload.get("nodes", [])
    edges: list[dict[str, Any]] = payload.get("edges", [])

    lo_nodes = [n for n in nodes if n.get("nodeType") == "LO"]
    concept_nodes = [n for n in nodes if n.get("nodeType") != "LO"]

    if lo_nodes:
        run_write(
            """
            MATCH (course:Course {id: $course_id})
            UNWIND $los AS lo
            MERGE (n:LearningOutcome {id: lo.id})
            ON CREATE SET n.ulid = lo.ulid
            SET n.ulid = coalesce(n.ulid, lo.ulid),
                n.name = lo.name,
                n.title = lo.name,
                n.code = lo.code,
                n.nodeType = 'LO',
                n.sequence = lo.sequence,
                n.status = lo.status
            MERGE (n)-[:IN_COURSE]->(course)
            MERGE (n)-[:DEVELOP]->(course)
            """,
            {"course_id": course_id, "los": lo_nodes},
        )

    if concept_nodes:
        run_write(
            """
            MATCH (course:Course {id: $course_id})
            UNWIND $concepts AS c
            MERGE (n:LearningNode {id: c.id})
            ON CREATE SET n.ulid = c.ulid
            SET n.ulid = coalesce(n.ulid, c.ulid),
                n.name = c.name,
                n.title = c.name,
                n.description = c.description,
                n.chapter_id = c.chapter_id,
                n.nodeType = 'Concept',
                n.sequence = c.sequence,
                n.status = c.status
            MERGE (n)-[:IN_COURSE]->(course)
            """,
            {"course_id": course_id, "concepts": concept_nodes},
        )

    for rel_type in ("DEVELOP", "PREREQUISITE", "PART_OF", "RELATED_TO"):
        rel_edges = [e for e in edges if e.get("type") == rel_type]
        if not rel_edges:
            continue
        run_write(
            f"""
            UNWIND $edges AS e
            MATCH (src {{id: e.source}}), (tgt {{id: e.target}})
            MERGE (src)-[r:{rel_type}]->(tgt)
            ON CREATE SET r.ulid = e.ulid
            SET r.ulid = coalesce(r.ulid, e.ulid),
                r.status = e.status,
                r.confidence = e.confidence
            """,
            {"edges": rel_edges},
        )

    cache_delete(f"g4lms:kg:{course_id}")


def process_pending_outbox_events(batch_size: int = 20) -> int:
    if not is_postgres_enabled():
        return 0

    with pg_conn() as conn:
        events = conn.execute(
            """
            SELECT id, aggregate_id, event_type, payload
            FROM outbox_events
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT %s
            FOR UPDATE SKIP LOCKED
            """,
            (batch_size,),
        ).fetchall()

        processed_count = 0
        for ev in events:
            ev_id = ev["id"]
            payload = ev["payload"]
            try:
                if ev["event_type"] == "KG_PROPOSAL_CREATED":
                    sync_kg_payload_to_neo4j(payload)
                    job_id = payload.get("job_id")
                    if job_id:
                        conn.execute(
                            "UPDATE kg_extraction_jobs SET status = 'completed', updated_at = NOW() WHERE id = %s",
                            (str(job_id),),
                        )
                conn.execute(
                    "UPDATE outbox_events SET status = 'processed', processed_at = NOW() WHERE id = %s",
                    (ev_id,),
                )
                processed_count += 1
            except Exception as exc:
                logger.exception("Failed syncing outbox event %s: %s", ev_id, exc)
                conn.execute(
                    """
                    UPDATE outbox_events
                    SET retry_count = retry_count + 1,
                        error_message = %s,
                        status = CASE WHEN retry_count >= 4 THEN 'failed' ELSE 'pending' END
                    WHERE id = %s
                    """,
                    (str(exc), ev_id),
                )
        return processed_count


def run_outbox_loop() -> None:
    verify_connectivity()
    ensure_postgres_schema()
    logger.info("Outbox Sync Worker started, polling PostgreSQL outbox_events...")
    while True:
        try:
            count = process_pending_outbox_events()
            if count == 0:
                time.sleep(1.5)
        except Exception as exc:
            logger.error("Outbox loop error: %s", exc)
            time.sleep(3)


if __name__ == "__main__":
    run_outbox_loop()
