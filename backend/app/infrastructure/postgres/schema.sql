-- Hybrid Persistence Layer: PostgreSQL schema for G4LMS
-- Stores transactional documents, extraction jobs, doc_chunk, ai_proposal_item, and outbox_events.

CREATE TABLE IF NOT EXISTS course_documents (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    s3_key TEXT NOT NULL,
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_documents_course_id ON course_documents (course_id, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS kg_extraction_jobs (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    document_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    error_message TEXT,
    nodes_created INT NOT NULL DEFAULT 0,
    edges_created INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_extraction_jobs_course ON kg_extraction_jobs (course_id, created_at DESC);

CREATE TABLE IF NOT EXISTS doc_chunk (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    document_id TEXT,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    token_estimate INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_chunk_course ON doc_chunk (course_id, document_id, chunk_index);

CREATE TABLE IF NOT EXISTS ai_proposal_item (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    item_kind TEXT NOT NULL, -- 'node' | 'edge'
    ulid TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_proposal_course ON ai_proposal_item (course_id, status);

CREATE TABLE IF NOT EXISTS outbox_events (
    id TEXT PRIMARY KEY,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_pending ON outbox_events (status, created_at ASC);
