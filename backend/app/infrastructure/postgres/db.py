from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import psycopg
from psycopg.rows import dict_row

from app.core.config import get_settings


def is_postgres_enabled() -> bool:
    return bool(get_settings().postgres_dsn.strip())


@contextmanager
def pg_conn() -> Iterator[psycopg.Connection]:
    dsn = get_settings().postgres_dsn.strip()
    if not dsn:
        raise RuntimeError("POSTGRES_DSN is not configured.")
    conn = psycopg.connect(dsn, row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def ensure_postgres_schema() -> None:
    if not is_postgres_enabled():
        return
    schema_path = Path(__file__).with_name("schema.sql")
    sql = schema_path.read_text(encoding="utf-8")
    with pg_conn() as conn:
        conn.execute(sql)


def verify_postgres_connectivity() -> bool:
    if not is_postgres_enabled():
        return False
    with pg_conn() as conn:
        conn.execute("SELECT 1")
    return True
