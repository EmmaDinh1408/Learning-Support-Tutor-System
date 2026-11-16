from datetime import datetime, timezone
from typing import Any

from app.infrastructure.neo4j.driver import run_write


def recalculate_student_course_progress(student_id: str, course_id: str) -> dict[str, Any]:
    rows = run_write(
        """
        MATCH (student:User {id: $student_id, role: 'student'})-[:HAS_ENROLLMENT]->(enrollment:Enrollment)-[:FOR_COURSE]->(course:Course {id: $course_id})
        OPTIONAL MATCH (node:LearningNode)-[:IN_COURSE]->(course)
        OPTIONAL MATCH (student)-[progress:HAS_PROGRESS]->(node)
        WITH enrollment, course,
             count(DISTINCT node) AS totalNodes,
             count(DISTINCT CASE WHEN progress.mastery >= 80 THEN node END) AS masteredNodes
        WITH enrollment,
             CASE WHEN totalNodes = 0 THEN coalesce(enrollment.progress, 0)
                  ELSE toInteger(round(masteredNodes * 100.0 / totalNodes))
             END AS calculatedProgress
        SET enrollment.progress = calculatedProgress,
            enrollment.updatedAt = $updated_at
        RETURN enrollment.id AS enrollmentId, enrollment.progress AS progress
        """,
        {
            "student_id": student_id,
            "course_id": course_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return rows[0] if rows else {"enrollmentId": None, "progress": 0}
