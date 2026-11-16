from typing import Any

from app.infrastructure.neo4j.driver import run_read, run_write


def find_user_by_identity(identity: str) -> dict[str, Any] | None:
    records = run_read(
        """
        MATCH (user:User)
        WHERE toLower(user.email) = toLower($identity)
           OR toLower(coalesce(user.studentCode, '')) = toLower($identity)
           OR toLower(coalesce(user.staffCode, '')) = toLower($identity)
        RETURN properties(user) AS user
        LIMIT 1
        """,
        {"identity": identity.strip()},
    )
    return records[0]["user"] if records else None


def find_user_by_id(user_id: str) -> dict[str, Any] | None:
    records = run_read(
        "MATCH (user:User {id: $user_id}) RETURN properties(user) AS user LIMIT 1",
        {"user_id": user_id},
    )
    return records[0]["user"] if records else None


def create_user(properties: dict[str, Any]) -> dict[str, Any]:
    records = run_write(
        "CREATE (user:User $properties) RETURN properties(user) AS user",
        {"properties": properties},
    )
    return records[0]["user"]


def update_user(user_id: str, properties: dict[str, Any]) -> dict[str, Any] | None:
    records = run_write(
        """
        MATCH (user:User {id: $user_id})
        SET user += $properties
        RETURN properties(user) AS user
        """,
        {"user_id": user_id, "properties": properties},
    )
    return records[0]["user"] if records else None


def list_users(limit: int = 500) -> list[dict[str, Any]]:
    records = run_read(
        """
        MATCH (user:User)
        RETURN properties(user) AS user
        ORDER BY user.createdAt DESC
        LIMIT $limit
        """,
        {"limit": limit},
    )
    return [record["user"] for record in records]


def delete_user(user_id: str) -> bool:
    records = run_write(
        """
        MATCH (user:User {id: $user_id})
        DETACH DELETE user
        RETURN $user_id AS id
        """,
        {"user_id": user_id},
    )
    return bool(records)
