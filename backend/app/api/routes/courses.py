from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import get_current_user, require_roles
from app.domain.models.api import CreateCourseRequest, UpdateCourseRequest, UpdateGradebookRowRequest
from app.infrastructure.neo4j.driver import run_read, run_write
from app.infrastructure.neo4j.repositories.course_repository import delete_course_by_id


router = APIRouter(tags=["Courses and grades"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]
StudentUser = Annotated[dict[str, Any], Depends(require_roles("student"))]
TeacherUser = Annotated[dict[str, Any], Depends(require_roles("teacher"))]


def _course_access(course_id: str, user: dict[str, Any]) -> dict[str, Any]:
    records = run_read(
        """
        MATCH (course:Course {id: $course_id})
        OPTIONAL MATCH (student:User {id: $user_id})-[:HAS_ENROLLMENT]->(enrollment:Enrollment)-[:FOR_COURSE]->(course)
        OPTIONAL MATCH (teacher:User {id: $user_id})-[:TEACHES]->(course)
        RETURN properties(course) AS course, enrollment.id AS enrollmentId, teacher.id AS teacherId
        LIMIT 1
        """,
        {"course_id": course_id, "user_id": user["id"]},
    )
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khóa học.")
    record = records[0]
    allowed = user.get("role") == "admin" or record.get("enrollmentId") or record.get("teacherId")
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền truy cập khóa học này.")
    return record["course"]


@router.get("/student/courses")
def get_student_courses(user: StudentUser) -> list[dict[str, Any]]:
    return run_read(
        """
        MATCH (student:User {id: $student_id})-[:HAS_ENROLLMENT]->(enrollment:Enrollment)-[:FOR_COURSE]->(course:Course)
        OPTIONAL MATCH (teacher:User)-[:TEACHES]->(course)
        RETURN course.id AS id, course.code AS code, course.title AS title,
               coalesce(course.description, '') AS description,
               coalesce(course.faculty, 'Khoa Khoa học Máy tính') AS faculty,
               coalesce(course.semester, 'HK1') AS semester,
               coalesce(course.year, 2026) AS year,
               coalesce(teacher.name, '') AS lecturer, coalesce(enrollment.progress, 0) AS progress,
               coalesce(enrollment.gap, '') AS gap, coalesce(enrollment.deadline, '') AS deadline,
               coalesce(course.theme, 'blue') AS theme
        ORDER BY course.code
        """,
        {"student_id": user["id"]},
    )


@router.get("/teacher/courses")
def get_teacher_courses(user: TeacherUser) -> list[dict[str, Any]]:
    return run_read(
        """
        MATCH (teacher:User {id: $teacher_id})-[:TEACHES]->(course:Course)
        CALL {
          WITH course
          OPTIONAL MATCH (:User {role: 'student'})-[:HAS_ENROLLMENT]->(enrollment:Enrollment)-[:FOR_COURSE]->(course)
          RETURN count(enrollment) AS studentCount
        }
        CALL {
          WITH course
          OPTIONAL MATCH (assignment:Assignment)-[:IN_COURSE]->(course)
          WHERE assignment.status = 'published'
          RETURN count(assignment) AS pendingCount
        }
        CALL {
          WITH course
          OPTIONAL MATCH (node:LearningNode)-[:IN_COURSE]->(course)
          RETURN count(node) AS totalNodes, count(CASE WHEN node.hasContent = true THEN 1 END) AS nodesWithContent
        }
        RETURN course.id AS id, course.code AS code, course.title AS title,
               coalesce(course.description, '') AS description,
               coalesce(course.faculty, 'Khoa Khoa học Máy tính') AS faculty,
               coalesce(course.semester, 'HK1') AS semester,
               coalesce(course.year, 2026) AS year,
               studentCount AS students, pendingCount AS pending,
               coalesce(course.published, false) AS published,
               nodesWithContent AS nodesWithContent, totalNodes AS totalNodes,
               coalesce(course.theme, 'blue') AS theme
        ORDER BY course.code
        """,
        {"teacher_id": user["id"]},
    )


@router.post("/teacher/courses", status_code=status.HTTP_201_CREATED)
def create_course(request: CreateCourseRequest, user: TeacherUser) -> dict[str, Any]:
    duplicate = run_read(
        """
        MATCH (teacher:User {id: $teacher_id})-[:TEACHES]->(course:Course)
        WHERE toLower(course.code) = toLower($code)
          AND coalesce(course.semester, '') = $semester
          AND coalesce(course.year, 0) = coalesce($year, 0)
        RETURN course.id AS id LIMIT 1
        """,
        {
            "teacher_id": user["id"],
            "code": request.code,
            "semester": request.semester,
            "year": request.year,
        },
    )
    if duplicate:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bạn đã tạo lớp học phần này.")

    course_id = f"course_{uuid4().hex}"
    properties = {
        "id": course_id,
        "code": request.code,
        "title": request.title,
        "description": request.description,
        "faculty": request.faculty,
        "semester": request.semester,
        "year": request.year,
        "published": False,
        "theme": request.theme,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    run_write(
        """
        MATCH (teacher:User {id: $teacher_id})
        CREATE (course:Course $properties)
        CREATE (teacher)-[:TEACHES]->(course)
        RETURN course.id AS id
        """,
        {"teacher_id": user["id"], "properties": properties},
    )
    return {
        "id": course_id,
        "code": request.code,
        "title": request.title,
        "description": request.description,
        "faculty": request.faculty,
        "semester": request.semester,
        "year": request.year,
        "students": 0,
        "pending": 0,
        "published": False,
        "nodesWithContent": 0,
        "totalNodes": 0,
        "theme": request.theme,
    }


@router.patch("/teacher/courses/{course_id}")
def update_teacher_course(
    course_id: str,
    request: UpdateCourseRequest,
    user: TeacherUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    updates: dict[str, Any] = {}
    for field in ("code", "title", "description", "faculty", "semester", "year", "theme", "published"):
        val = getattr(request, field)
        if val is not None:
            updates[field] = val.strip() if isinstance(val, str) else val
    run_write(
        """
        MATCH (course:Course {id: $course_id})
        SET course += $updates
        RETURN course.id AS id
        """,
        {"course_id": course_id, "updates": updates},
    )
    courses = get_teacher_courses(user)
    updated = next((item for item in courses if item["id"] == course_id), None)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khóa học.")
    return updated


@router.delete("/teacher/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_teacher_course(course_id: str, user: TeacherUser) -> Response:
    _course_access(course_id, user)
    if not delete_course_by_id(course_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khóa học.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)



@router.get("/courses/{course_id}/sections")
def get_course_sections(course_id: str, user: CurrentUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    records = run_read(
        """
        MATCH (course:Course {id: $course_id})
        OPTIONAL MATCH (course)-[:HAS_SECTION]->(section:Section)
        OPTIONAL MATCH (section)-[:HAS_RESOURCE]->(resource:LearningResource)
        WITH section, collect(CASE WHEN resource IS NULL THEN null ELSE {
          id: resource.id, nameVi: resource.nameVi, nameEn: resource.nameEn,
          kind: resource.kind, url: resource.url
        } END) AS items
        WHERE section IS NOT NULL
        RETURN section.id AS id, section.titleVi AS titleVi, section.titleEn AS titleEn,
               items AS items
        ORDER BY section.sequence
        """,
        {"course_id": course_id},
    )
    return records


@router.get("/teacher/courses/{course_id}/topics")
def get_teacher_topics(course_id: str, user: TeacherUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    records = run_read(
        """
        MATCH (course:Course {id: $course_id})-[:HAS_SECTION]->(section:Section)
        OPTIONAL MATCH (section)-[:HAS_RESOURCE]->(resource:LearningResource)
        RETURN section.id AS id, toString(section.sequence) AS number,
               section.titleVi AS titleVi, section.titleEn AS titleEn,
               collect(CASE WHEN resource IS NULL THEN null ELSE resource.nameVi END) AS resources
        ORDER BY section.sequence
        """,
        {"course_id": course_id},
    )
    return [{**record, "resources": [item for item in record["resources"] if item]} for record in records]


@router.get("/teacher/courses/{course_id}/students")
def get_teacher_roster(course_id: str, user: TeacherUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    return run_read(
        """
        MATCH (student:User {role: 'student'})-[:HAS_ENROLLMENT]->(enrollment:Enrollment)-[:FOR_COURSE]->(course:Course {id: $course_id})
        RETURN student.id AS id, student.name AS name, student.email AS email,
               enrollment.enrolledAt AS enrolledAt,
               CASE WHEN enrollment.status = 'withdrawn' THEN 'withdrawn' ELSE 'active' END AS status,
               coalesce(enrollment.progress, 0) AS progress
        ORDER BY student.name
        """,
        {"course_id": course_id},
    )


@router.get("/teacher/courses/{course_id}/gradebook")
def get_teacher_gradebook(course_id: str, user: TeacherUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    return run_read(
        """
        MATCH (student:User {role: 'student'})-[:HAS_ENROLLMENT]->(enrollment:Enrollment)-[:FOR_COURSE]->(course:Course {id: $course_id})
        WITH student, enrollment, course,
             CASE WHEN enrollment.midterm IS NULL OR enrollment.project IS NULL
                       OR enrollment.final IS NULL OR enrollment.attendance IS NULL
                  THEN null
                  ELSE round(
                    (enrollment.midterm * coalesce(course.midtermWeight, 0.3)
                     + enrollment.project * coalesce(course.projectWeight, 0.25)
                     + enrollment.final * coalesce(course.finalWeight, 0.35)
                     + (enrollment.attendance / 10.0) * coalesce(course.attendanceWeight, 0.1)) * 10.0
                  ) / 10.0
             END AS totalScore
        RETURN student.id AS id, student.name AS name,
               CASE WHEN enrollment.status = 'withdrawn' THEN 'withdrawn' ELSE 'active' END AS status,
               coalesce(enrollment.progress, 0) AS progress,
               enrollment.midterm AS midterm, enrollment.project AS project,
               enrollment.final AS final, enrollment.attendance AS attendance,
               totalScore AS totalScore
        ORDER BY student.name
        """,
        {"course_id": course_id},
    )


@router.patch("/teacher/courses/{course_id}/gradebook/{student_id}")
def update_teacher_gradebook_row(
    course_id: str,
    student_id: str,
    request: UpdateGradebookRowRequest,
    user: TeacherUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    rows = run_write(
        """
        MATCH (student:User {id: $student_id, role: 'student'})-[:HAS_ENROLLMENT]->(enrollment:Enrollment)-[:FOR_COURSE]->(course:Course {id: $course_id})
        SET enrollment.midterm = $midterm,
            enrollment.project = $project,
            enrollment.final = $final,
            enrollment.attendance = $attendance
        WITH student, enrollment, course,
             CASE WHEN enrollment.midterm IS NULL OR enrollment.project IS NULL
                       OR enrollment.final IS NULL OR enrollment.attendance IS NULL
                  THEN null
                  ELSE round(
                    (enrollment.midterm * coalesce(course.midtermWeight, 0.3)
                     + enrollment.project * coalesce(course.projectWeight, 0.25)
                     + enrollment.final * coalesce(course.finalWeight, 0.35)
                     + (enrollment.attendance / 10.0) * coalesce(course.attendanceWeight, 0.1)) * 10.0
                  ) / 10.0
             END AS totalScore
        SET enrollment.finalScore = totalScore,
            enrollment.gradePublished = (totalScore IS NOT NULL),
            enrollment.letterGrade = CASE
              WHEN totalScore IS NULL THEN null
              WHEN totalScore >= 8.5 THEN 'A'
              WHEN totalScore >= 8.0 THEN 'B+'
              WHEN totalScore >= 7.0 THEN 'B'
              WHEN totalScore >= 6.5 THEN 'C+'
              WHEN totalScore >= 5.5 THEN 'C'
              WHEN totalScore >= 5.0 THEN 'D+'
              WHEN totalScore >= 4.0 THEN 'D'
              ELSE 'F'
            END
        RETURN student.id AS id, student.name AS name,
               CASE WHEN enrollment.status = 'withdrawn' THEN 'withdrawn' ELSE 'active' END AS status,
               coalesce(enrollment.progress, 0) AS progress,
               enrollment.midterm AS midterm, enrollment.project AS project,
               enrollment.final AS final, enrollment.attendance AS attendance,
               totalScore AS totalScore
        """,
        {
            "course_id": course_id,
            "student_id": student_id,
            "midterm": request.midterm,
            "project": request.project,
            "final": request.final,
            "attendance": request.attendance,
        },
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sinh viên trong khóa học.")
    return rows[0]



@router.get("/student/courses/{course_id}/grades")
def get_student_course_grades(course_id: str, user: StudentUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    return run_read(
        """
        MATCH (student:User {id: $student_id})-[:HAS_ENROLLMENT]->(enrollment:Enrollment)-[:FOR_COURSE]->(course:Course {id: $course_id})
        OPTIONAL MATCH (grade:GradeItem)-[:FOR_COURSE]->(course)
        OPTIONAL MATCH (student)-[result:HAS_GRADE]->(grade)
        WHERE grade IS NOT NULL
        RETURN grade.id AS id, coalesce(grade.category, 'manual') AS category,
               coalesce(grade.titleVi, grade.title, '') AS titleVi,
               coalesce(grade.titleEn, grade.title, '') AS titleEn,
               result.score AS score, coalesce(grade.maxScore, 10) AS maxScore,
               grade.weight AS weight, result.feedback AS feedback
        ORDER BY grade.sequence
        """,
        {"student_id": user["id"], "course_id": course_id},
    )


@router.get("/student/grades")
def get_student_grade_summary(user: StudentUser) -> list[dict[str, Any]]:
    return run_read(
        """
        MATCH (student:User {id: $student_id})-[:HAS_ENROLLMENT]->(enrollment:Enrollment)-[:FOR_COURSE]->(course:Course)
        RETURN course.id AS courseId, course.code AS courseCode, course.title AS courseTitle,
               coalesce(course.semester, '') AS term, coalesce(course.credits, 0) AS credits,
               enrollment.finalScore AS finalScore, 10 AS maxScore,
               enrollment.letterGrade AS letterGrade,
               CASE WHEN enrollment.status = 'withdrawn' THEN 'incomplete'
                    WHEN enrollment.gradePublished = true THEN 'published'
                    ELSE 'in_progress' END AS status
        ORDER BY course.year DESC, course.semester, course.code
        """,
        {"student_id": user["id"]},
    )
