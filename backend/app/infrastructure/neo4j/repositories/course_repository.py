from typing import Any

from app.infrastructure.neo4j.driver import run_read, run_write


def find_course_by_id(course_id: str) -> dict[str, Any] | None:
    records = run_read(
        """
        MATCH (course:Course {id: $course_id})
        OPTIONAL MATCH (teacher:User)-[:TEACHES]->(course)
        RETURN properties(course) AS course, teacher.id AS teacherId, teacher.name AS teacherName
        LIMIT 1
        """,
        {"course_id": course_id},
    )
    if not records:
        return None
    record = records[0]
    return {
        **record["course"],
        "teacherId": record.get("teacherId"),
        "teacherName": record.get("teacherName"),
    }


def list_all_courses() -> list[dict[str, Any]]:
    return run_read(
        """
        MATCH (course:Course)
        OPTIONAL MATCH (teacher:User)-[:TEACHES]->(course)
        CALL {
          WITH course
          OPTIONAL MATCH (:User {role: 'student'})-[:HAS_ENROLLMENT]->(enrollment:Enrollment)-[:FOR_COURSE]->(course)
          RETURN count(enrollment) AS studentCount
        }
        RETURN course.id AS id, course.code AS code, course.title AS title,
               coalesce(course.description, '') AS description,
               coalesce(course.faculty, 'Khoa Khoa học Máy tính') AS faculty,
               coalesce(course.semester, 'HK1') AS semester,
               coalesce(course.year, 2026) AS year,
               coalesce(course.theme, 'blue') AS theme,
               coalesce(course.published, false) AS published,
               teacher.id AS lecturerId,
               coalesce(teacher.name, '') AS lecturerName,
               studentCount AS students,
               course.createdAt AS createdAt
        ORDER BY course.createdAt DESC, course.code
        """
    )


def update_course_properties(course_id: str, properties: dict[str, Any], lecturer_id: str | None = None) -> dict[str, Any] | None:
    records = run_write(
        """
        MATCH (course:Course {id: $course_id})
        SET course += $properties
        RETURN properties(course) AS course
        """,
        {"course_id": course_id, "properties": properties},
    )
    if not records:
        return None
    if lecturer_id is not None:
        run_write(
            """
            MATCH (course:Course {id: $course_id})
            OPTIONAL MATCH (old_teacher:User)-[rel:TEACHES]->(course)
            DELETE rel
            WITH course
            OPTIONAL MATCH (new_teacher:User {id: $lecturer_id, role: 'teacher'})
            FOREACH (_ IN CASE WHEN new_teacher IS NULL THEN [] ELSE [1] END |
              MERGE (new_teacher)-[:TEACHES]->(course)
            )
            """,
            {"course_id": course_id, "lecturer_id": lecturer_id},
        )
    return find_course_by_id(course_id)


def delete_course_by_id(course_id: str) -> bool:
    records = run_write(
        """
        MATCH (course:Course {id: $course_id})
        OPTIONAL MATCH (enrollment:Enrollment)-[:FOR_COURSE]->(course)
        OPTIONAL MATCH (assignment:Assignment)-[:IN_COURSE]->(course)
        OPTIONAL MATCH (submission:Submission)-[:FOR_ASSIGNMENT]->(assignment)
        OPTIONAL MATCH (announcement:Announcement)-[:IN_COURSE]->(course)
        OPTIONAL MATCH (session:AttendanceSession)-[:IN_COURSE]->(course)
        OPTIONAL MATCH (session)-[:HAS_RECORD]->(att_record:AttendanceRecord)
        OPTIONAL MATCH (quiz:Quiz)-[:IN_COURSE]->(course)
        OPTIONAL MATCH (question:QuizQuestion)-[:PART_OF]->(quiz)
        OPTIONAL MATCH (attempt:QuizAttempt)-[:FOR_QUIZ]->(quiz)
        OPTIONAL MATCH (attempt)-[:HAS_RESPONSE]->(response:QuizResponse)
        DETACH DELETE response, attempt, question, quiz, att_record, session, announcement, submission, assignment, enrollment, course
        RETURN $course_id AS id
        """,
        {"course_id": course_id},
    )
    return bool(records)
