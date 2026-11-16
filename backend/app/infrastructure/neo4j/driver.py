from pathlib import Path
from typing import Any

from neo4j import Driver, GraphDatabase

from app.core.config import get_settings

_driver: Driver | None = None


def get_driver() -> Driver:
    global _driver
    if _driver is None:
        settings = get_settings()
        if not settings.neo4j_password:
            raise RuntimeError("NEO4J_PASSWORD must be configured before starting the API.")
        _driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
    return _driver


def close_driver() -> None:
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


def verify_connectivity() -> None:
    get_driver().verify_connectivity()


def run_read(query: str, parameters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    settings = get_settings()
    with get_driver().session(database=settings.neo4j_database) as session:
        return [record.data() for record in session.run(query, parameters or {})]


def run_write(query: str, parameters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    settings = get_settings()
    with get_driver().session(database=settings.neo4j_database) as session:
        return session.execute_write(
            lambda transaction: [
                record.data()
                for record in transaction.run(query, parameters or {})
            ]
        )


def ensure_schema() -> None:
    schema_path = Path(__file__).with_name("schema.cypher")
    statements = [
        statement.strip()
        for statement in schema_path.read_text(encoding="utf-8").split(";")
        if statement.strip()
    ]
    seed_path = Path(__file__).with_name("seed.cypher")
    seed_statements = [
        statement.strip()
        for statement in seed_path.read_text(encoding="utf-8").split(";")
        if statement.strip()
    ] if seed_path.is_file() else []
    settings = get_settings()
    with get_driver().session(database=settings.neo4j_database) as session:
        for statement in statements:
            session.run(statement).consume()
        for statement in seed_statements:
            session.run(statement).consume()
