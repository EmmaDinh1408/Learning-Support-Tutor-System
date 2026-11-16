from typing import Any

from app.application.services.ranking_service import rank_recommendations
from app.infrastructure.neo4j.repositories.student_repository import get_student_recommendations


def build_course_recommendations(student_id: str, course_id: str, limit: int = 6) -> list[dict[str, Any]]:
    raw_candidates = get_student_recommendations(student_id, course_id, limit=limit * 2)
    ranked = rank_recommendations(raw_candidates)
    return ranked[:limit]
