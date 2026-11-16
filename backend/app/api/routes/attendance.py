from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import require_roles
from app.api.routes.courses import _course_access
from app.domain.models.api import CreateAttendanceSessionRequest, UpdateAttendanceSessionRequest
from app.infrastructure.neo4j.driver import run_read, run_write

router = APIRouter(tags=["Attendance"])
StudentUser = Annotated[dict[str, Any], Depends(require_roles("student"))]
TeacherUser = Annotated[dict[str, Any], Depends(require_roles("teacher"))]


@router.get("/teacher/courses/{course_id}/attendance")
def get_teacher_attendance(course_id: str, user: TeacherUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    records = run_read(
        """
        MATCH (session:AttendanceSession)-[:IN_COURSE]->(course:Course {id: $course_id})
        OPTIONAL MATCH (session)-[:HAS_RECORD]->(record:AttendanceRecord)-[:FOR_STUDENT]->(student:User)
        WITH session, collect(CASE WHEN record IS NULL THEN null ELSE {
          studentId: student.id, name: student.name, status: record.status, note: record.note
        } END) AS entries
        RETURN session.id AS id, course.id AS courseId, session.title AS title,
               session.date AS date, session.status AS status, entries AS records
        ORDER BY session.date DESC
        """,
        {"course_id": course_id},
    )
    return records


@router.post("/teacher/courses/{course_id}/attendance/sessions", status_code=status.HTTP_201_CREATED)
def create_attendance_session(
    course_id: str,
    request: CreateAttendanceSessionRequest,
    user: TeacherUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    session_id = f"attendance_{uuid4().hex}"
    session_date = request.date.isoformat()
    session_title = request.title.strip()
    rows = run_write(
        """
        MATCH (course:Course {id: $course_id})
        CREATE (session:AttendanceSession {
          id: $session_id, title: $title, date: $date,
          status: 'draft', createdAt: $created_at
        })
        CREATE (session)-[:IN_COURSE]->(course)
        RETURN session.id AS id
        """,
        {
            "course_id": course_id,
            "session_id": session_id,
            "title": session_title,
            "date": session_date,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khóa học.")
    roster = run_read(
        """
        MATCH (student:User {role: 'student', active: true})-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(:Course {id: $course_id})
        RETURN student.id AS id, student.name AS name
        """,
        {"course_id": course_id},
    )
    if roster:
        run_write(
            """
            MATCH (session:AttendanceSession {id: $session_id})
            UNWIND $student_ids AS student_id
            MATCH (student:User {id: student_id})
            CREATE (session)-[:HAS_RECORD]->(:AttendanceRecord {
              id: $session_id + '_' + student_id, status: 'unmarked'
            })-[:FOR_STUDENT]->(student)
            """,
            {"session_id": session_id, "student_ids": [item["id"] for item in roster]},
        )
    return {
        "id": session_id,
        "courseId": course_id,
        "title": session_title,
        "date": session_date,
        "status": "draft",
        "records": [
            {"studentId": student["id"], "name": student["name"], "status": "unmarked"}
            for student in roster
        ],
    }


@router.patch("/teacher/courses/{course_id}/attendance/sessions/{session_id}")
def update_attendance_session(
    course_id: str,
    session_id: str,
    request: UpdateAttendanceSessionRequest,
    user: TeacherUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    student_ids = [record.studentId for record in request.records]
    if len(set(student_ids)) != len(student_ids):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Sinh viên bị lặp trong danh sách điểm danh.")
    session = run_read(
        """
        MATCH (session:AttendanceSession {id: $session_id})-[:IN_COURSE]->(:Course {id: $course_id})
        RETURN session.id AS id
        LIMIT 1
        """,
        {"session_id": session_id, "course_id": course_id},
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy buổi điểm danh.")
    if request.status == "published" and any(record.status == "unmarked" for record in request.records):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cần điểm danh đầy đủ trước khi công bố.",
        )
    if student_ids:
        valid = run_read(
            """
            MATCH (student:User {role: 'student', active: true})-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(:Course {id: $course_id})
            WHERE student.id IN $student_ids
            RETURN count(DISTINCT student.id) AS count
            """,
            {"course_id": course_id, "student_ids": student_ids},
        )[0]["count"]
        if valid != len(student_ids):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Danh sách chứa sinh viên không thuộc khóa học.")
    run_write(
        """
        MATCH (session:AttendanceSession {id: $session_id})-[:IN_COURSE]->(:Course {id: $course_id})
        SET session.status = $status
        WITH session
        UNWIND $records AS entry
        MATCH (student:User {id: entry.studentId})
        MERGE (session)-[:HAS_RECORD]->(record:AttendanceRecord {id: $session_id + '_' + entry.studentId})-[:FOR_STUDENT]->(student)
        SET record.status = entry.status, record.note = entry.note
        """,
        {
            "session_id": session_id,
            "course_id": course_id,
            "status": request.status,
            "records": [record.model_dump() for record in request.records],
        },
    )
    rows = run_read(
        """
        MATCH (session:AttendanceSession {id: $session_id})-[:IN_COURSE]->(course:Course {id: $course_id})
        OPTIONAL MATCH (session)-[:HAS_RECORD]->(record:AttendanceRecord)-[:FOR_STUDENT]->(student:User)
        RETURN session.id AS id, course.id AS courseId, session.title AS title,
               session.date AS date, session.status AS status,
               collect(CASE WHEN record IS NULL THEN null ELSE {
                 studentId: student.id, name: student.name, status: record.status, note: record.note
               } END) AS records
        """,
        {"session_id": session_id, "course_id": course_id},
    )
    return rows[0]


@router.delete("/teacher/courses/{course_id}/attendance/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attendance_session(
    course_id: str,
    session_id: str,
    user: TeacherUser,
) -> Response:
    _course_access(course_id, user)
    deleted = run_write(
        """
        MATCH (session:AttendanceSession {id: $session_id})-[:IN_COURSE]->(:Course {id: $course_id})
        OPTIONAL MATCH (session)-[:HAS_RECORD]->(record:AttendanceRecord)
        DETACH DELETE record, session
        RETURN $session_id AS id
        """,
        {"session_id": session_id, "course_id": course_id},
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy buổi điểm danh.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/student/courses/{course_id}/attendance")
def get_student_attendance(course_id: str, user: StudentUser) -> dict[str, Any]:
    _course_access(course_id, user)
    rows = run_read(
        """
        MATCH (student:User {id: $student_id})-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(course:Course {id: $course_id})
        MATCH (session:AttendanceSession)-[:IN_COURSE]->(course)
        WHERE session.status = 'published'
        OPTIONAL MATCH (session)-[:HAS_RECORD]->(record:AttendanceRecord)-[:FOR_STUDENT]->(student)
        RETURN session.id AS sessionId, session.title AS title, session.date AS date,
               record.status AS status
        ORDER BY session.date DESC
        """,
        {"student_id": user["id"], "course_id": course_id},
    )
    records = [
        {"sessionId": row["sessionId"], "title": row["title"], "date": row["date"], "status": row["status"]}
        for row in rows
        if row.get("status") in {"present", "absent", "late", "excused"}
    ]
    counts = {name: sum(1 for row in records if row["status"] == name) for name in ("present", "absent", "late", "excused")}
    total = len(records)
    attended = counts["present"] + counts["late"] + counts["excused"]
    rate = round(attended * 100 / total) if total > 0 else 0
    return {
        "totalSessions": total,
        **counts,
        "attendanceRate": rate,
        "records": records,
    }

