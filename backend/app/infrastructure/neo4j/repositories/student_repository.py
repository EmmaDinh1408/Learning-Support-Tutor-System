from pathlib import Path
from typing import Any

from app.infrastructure.neo4j.driver import run_read


def get_student_learning_profile(student_id: str, course_id: str | None = None) -> dict[str, Any]:
    courses = run_read(
        """
        MATCH (student:User {id: $student_id, role: 'student'})-[:HAS_ENROLLMENT]->(enrollment:Enrollment)-[:FOR_COURSE]->(course:Course)
        WHERE $course_id IS NULL OR course.id = $course_id
        OPTIONAL MATCH (node:LearningNode)-[:IN_COURSE]->(course)
        OPTIONAL MATCH (student)-[progress:HAS_PROGRESS]->(node)
        WITH course, enrollment,
             count(DISTINCT node) AS totalNodes,
             count(DISTINCT CASE WHEN progress.mastery >= 80 THEN node END) AS masteredNodes,
             count(DISTINCT CASE WHEN progress.mastery > 0 AND progress.mastery < 80 THEN node END) AS inProgressNodes,
             avg(coalesce(progress.mastery, 0)) AS avgMastery
        RETURN course.id AS courseId,
               course.code AS courseCode,
               course.title AS courseTitle,
               coalesce(enrollment.progress, 0) AS progress,
               coalesce(enrollment.gap, '') AS gap,
               totalNodes AS totalNodes,
               masteredNodes AS masteredNodes,
               inProgressNodes AS inProgressNodes,
               round(coalesce(avgMastery, 0), 1) AS averageMastery
        ORDER BY course.code
        """,
        {"student_id": student_id, "course_id": course_id},
    )
    weak_nodes = run_read(
        """
        MATCH (student:User {id: $student_id, role: 'student'})-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(course:Course)
        WHERE $course_id IS NULL OR course.id = $course_id
        MATCH (node:LearningNode)-[:IN_COURSE]->(course)
        OPTIONAL MATCH (student)-[progress:HAS_PROGRESS]->(node)
        OPTIONAL MATCH (node)-[:IN_CLUSTER]->(cluster:LearningCluster)
        WITH course, node, cluster, coalesce(progress.mastery, 0) AS mastery
        WHERE mastery < 80
        RETURN node.id AS id,
               node.title AS title,
               course.id AS courseId,
               course.code AS courseCode,
               coalesce(cluster.name, '') AS cluster,
               mastery AS mastery,
               coalesce(node.learningOutcomeId, '') AS lo
        ORDER BY mastery ASC, node.sequence ASC
        LIMIT 10
        """,
        {"student_id": student_id, "course_id": course_id},
    )
    total_courses = len(courses)
    overall_progress = round(sum(float(c.get("progress", 0)) for c in courses) / total_courses) if total_courses else 0
    return {
        "studentId": student_id,
        "overallProgress": overall_progress,
        "courses": courses,
        "knowledgeGaps": weak_nodes,
    }


def get_student_recommendations(student_id: str, course_id: str, limit: int = 6) -> list[dict[str, Any]]:
    query_path = Path(__file__).resolve().parents[1] / "queries" / "recommendations.cypher"
    query = query_path.read_text(encoding="utf-8")
    return run_read(
        query,
        {"student_id": student_id, "course_id": course_id, "limit": limit},
    )
