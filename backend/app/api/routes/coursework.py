from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import get_current_user, require_roles
from app.api.routes.courses import _course_access
from app.domain.models.api import (
    CreateAnnouncementRequest,
    CreateAssignmentRequest,
    GradeSubmissionRequest,
    SubmitAssignmentRequest,
    UpdateAnnouncementRequest,
    UpdateAssignmentRequest,
)
from app.infrastructure.neo4j.driver import run_read, run_write

router = APIRouter(tags=["Assignments and announcements"])
StudentUser = Annotated[dict[str, Any], Depends(require_roles("student"))]
TeacherUser = Annotated[dict[str, Any], Depends(require_roles("teacher"))]
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def _assignment_response(record: dict[str, Any], include_submission: bool) -> dict[str, Any]:
    assignment = {
        "id": record["id"],
        "courseId": record["courseId"],
        "title": record["title"],
        "description": record.get("description", ""),
        "dueAt": record["dueAt"],
        "maxScore": record["maxScore"],
        "status": record["status"],
        "submissionStatus": record.get("submissionStatus", "not_submitted"),
        "submittedAt": record.get("submittedAt"),
        "score": record.get("score"),
        "feedback": record.get("feedback"),
    }
    if "submissionCount" in record:
        assignment["submissionCount"] = int(record.get("submissionCount") or 0)
    if "gradedCount" in record:
        assignment["gradedCount"] = int(record.get("gradedCount") or 0)
    if include_submission:
        assignment["submissionText"] = record.get("submissionText")
    return assignment



@router.get("/student/courses/{course_id}/assignments")
def get_student_assignments(course_id: str, user: StudentUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    records = run_read(
        """
        MATCH (student:User {id: $student_id})-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(course:Course {id: $course_id})
        MATCH (assignment:Assignment)-[:IN_COURSE]->(course)
        WHERE assignment.status = 'published'
        OPTIONAL MATCH (student)-[:SUBMITTED]->(submission:Submission)-[:FOR_ASSIGNMENT]->(assignment)
        WITH assignment, submission
        ORDER BY submission.submittedAt DESC
        WITH assignment, collect(submission)[0] AS latest
        RETURN assignment.id AS id, course.id AS courseId, assignment.title AS title,
               coalesce(assignment.description, '') AS description, assignment.dueAt AS dueAt,
               assignment.maxScore AS maxScore, assignment.status AS status,
               CASE WHEN latest IS NULL THEN 'not_submitted'
                    WHEN latest.score IS NOT NULL THEN 'graded'
                    WHEN latest.status = 'late' THEN 'late'
                    ELSE 'submitted' END AS submissionStatus,
               latest.submittedAt AS submittedAt, latest.score AS score,
               latest.feedback AS feedback, latest.text AS submissionText
        ORDER BY assignment.dueAt
        """,
        {"student_id": user["id"], "course_id": course_id},
    )
    return [_assignment_response(record, True) for record in records]


@router.get("/teacher/courses/{course_id}/assignments")
def get_teacher_assignments(course_id: str, user: TeacherUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    records = run_read(
        """
        MATCH (course:Course {id: $course_id})
        MATCH (assignment:Assignment)-[:IN_COURSE]->(course)
        OPTIONAL MATCH (submission:Submission)-[:FOR_ASSIGNMENT]->(assignment)
        RETURN assignment.id AS id, course.id AS courseId, assignment.title AS title,
               coalesce(assignment.description, '') AS description, assignment.dueAt AS dueAt,
               assignment.maxScore AS maxScore, assignment.status AS status,
               count(submission) AS submissionCount,
               count(CASE WHEN submission.score IS NOT NULL THEN 1 END) AS gradedCount
        ORDER BY assignment.dueAt
        """,
        {"course_id": course_id},
    )
    return [_assignment_response(record, False) for record in records]


@router.post("/teacher/courses/{course_id}/assignments", status_code=status.HTTP_201_CREATED)
def create_assignment(course_id: str, request: CreateAssignmentRequest, user: TeacherUser) -> dict[str, Any]:
    _course_access(course_id, user)
    assignment_id = f"assignment_{uuid4().hex}"
    due_at = request.dueAt.astimezone(timezone.utc).isoformat()
    run_write(
        """
        MATCH (course:Course {id: $course_id})
        CREATE (assignment:Assignment {
          id: $id, title: $title, description: $description, dueAt: $due_at,
          maxScore: $max_score, status: 'draft', createdAt: $created_at
        })
        CREATE (assignment)-[:IN_COURSE]->(course)
        RETURN assignment.id AS id
        """,
        {
            "course_id": course_id,
            "id": assignment_id,
            "title": request.title.strip(),
            "description": request.description.strip(),
            "due_at": due_at,
            "max_score": request.maxScore,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {
        "id": assignment_id,
        "courseId": course_id,
        "title": request.title.strip(),
        "description": request.description.strip(),
        "dueAt": due_at,
        "maxScore": request.maxScore,
        "status": "draft",
        "submissionStatus": "not_submitted",
        "submittedAt": None,
        "score": None,
        "feedback": None,
        "submissionCount": 0,
        "gradedCount": 0,
    }


@router.patch("/teacher/courses/{course_id}/assignments/{assignment_id}")
def update_assignment(
    course_id: str,
    assignment_id: str,
    request: UpdateAssignmentRequest,
    user: TeacherUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    records = run_read(
        """
        MATCH (assignment:Assignment {id: $assignment_id})-[:IN_COURSE]->(course:Course {id: $course_id})
        RETURN properties(assignment) AS assignment
        LIMIT 1
        """,
        {"assignment_id": assignment_id, "course_id": course_id},
    )
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bài tập.")
    current = records[0]["assignment"]
    current_status = current.get("status", "draft")
    if request.status is not None and request.status != current_status:
        allowed = (current_status == "draft" and request.status == "published") or (
            current_status == "published" and request.status == "closed"
        ) or (current_status == "closed" and request.status == "published")
        if not allowed:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Không thể chuyển bài tập sang trạng thái này.")

    new_title = request.title.strip() if request.title is not None else current.get("title", "")
    new_desc = request.description.strip() if request.description is not None else current.get("description", "")
    new_due = request.dueAt.astimezone(timezone.utc).isoformat() if request.dueAt is not None else current.get("dueAt")
    new_max = request.maxScore if request.maxScore is not None else current.get("maxScore", 10)
    new_status = request.status if request.status is not None else current_status

    updated = run_write(
        """
        MATCH (assignment:Assignment {id: $assignment_id})-[:IN_COURSE]->(:Course {id: $course_id})
        SET assignment.title = $title,
            assignment.description = $description,
            assignment.dueAt = $due_at,
            assignment.maxScore = $max_score,
            assignment.status = $status
        OPTIONAL MATCH (submission:Submission)-[:FOR_ASSIGNMENT]->(assignment)
        RETURN assignment.id AS id, assignment.title AS title,
               assignment.description AS description, assignment.dueAt AS dueAt,
               assignment.maxScore AS maxScore, assignment.status AS status,
               count(submission) AS submissionCount,
               count(CASE WHEN submission.score IS NOT NULL THEN 1 END) AS gradedCount
        """,
        {
            "assignment_id": assignment_id,
            "course_id": course_id,
            "title": new_title,
            "description": new_desc,
            "due_at": new_due,
            "max_score": new_max,
            "status": new_status,
        },
    )[0]
    return _assignment_response(
        {**updated, "courseId": course_id, "submissionStatus": "not_submitted"},
        False,
    )


@router.delete("/teacher/courses/{course_id}/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    course_id: str,
    assignment_id: str,
    user: TeacherUser,
) -> Response:
    _course_access(course_id, user)
    deleted = run_write(
        """
        MATCH (assignment:Assignment {id: $assignment_id})-[:IN_COURSE]->(:Course {id: $course_id})
        OPTIONAL MATCH (submission:Submission)-[:FOR_ASSIGNMENT]->(assignment)
        DETACH DELETE submission, assignment
        RETURN $assignment_id AS id
        """,
        {"assignment_id": assignment_id, "course_id": course_id},
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bài tập.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/student/courses/{course_id}/assignments/{assignment_id}/submissions")
def submit_assignment(
    course_id: str,
    assignment_id: str,
    request: SubmitAssignmentRequest,
    user: StudentUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    matches = run_read(
        """
        MATCH (assignment:Assignment {id: $assignment_id})-[:IN_COURSE]->(course:Course {id: $course_id})
        RETURN assignment.status AS status, assignment.dueAt AS dueAt
        LIMIT 1
        """,
        {"assignment_id": assignment_id, "course_id": course_id},
    )
    if not matches:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bài tập.")
    if matches[0]["status"] != "published":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bài tập chưa mở hoặc đã đóng.")

    now = datetime.now(timezone.utc)
    due_at = datetime.fromisoformat(str(matches[0]["dueAt"]).replace("Z", "+00:00"))
    submission_status = "late" if now > due_at else "submitted"
    submission_id = f"submission_{assignment_id}_{user['id']}"
    submitted_at = now.isoformat()
    run_write(
        """
        MATCH (student:User {id: $student_id})
        MATCH (assignment:Assignment {id: $assignment_id})
        MERGE (student)-[:SUBMITTED]->(submission:Submission {id: $submission_id})-[:FOR_ASSIGNMENT]->(assignment)
        SET submission.text = $text,
            submission.status = $submission_status,
            submission.submittedAt = $submitted_at
        RETURN submission.id AS id
        """,
        {
            "student_id": user["id"],
            "assignment_id": assignment_id,
            "submission_id": submission_id,
            "text": request.text,
            "submission_status": submission_status,
            "submitted_at": submitted_at,
        },
    )
    records = run_read(
        """
        MATCH (assignment:Assignment {id: $assignment_id})-[:IN_COURSE]->(course:Course {id: $course_id})
        RETURN assignment.id AS id, course.id AS courseId, assignment.title AS title,
               coalesce(assignment.description, '') AS description, assignment.dueAt AS dueAt,
               assignment.maxScore AS maxScore, assignment.status AS status
        """,
        {"assignment_id": assignment_id, "course_id": course_id},
    )
    return _assignment_response(
        {
            **records[0],
            "submissionStatus": submission_status,
            "submittedAt": submitted_at,
            "score": None,
            "feedback": None,
            "submissionText": request.text,
        },
        True,
    )



@router.get("/teacher/courses/{course_id}/assignments/{assignment_id}/submissions")
def get_submissions(course_id: str, assignment_id: str, user: TeacherUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    return run_read(
        """
        MATCH (assignment:Assignment {id: $assignment_id})-[:IN_COURSE]->(:Course {id: $course_id})
        MATCH (student:User)-[:SUBMITTED]->(submission:Submission)-[:FOR_ASSIGNMENT]->(assignment)
        RETURN submission.id AS id, student.id AS studentId, student.name AS studentName,
               submission.text AS text, submission.submittedAt AS submittedAt,
               submission.status AS status, submission.score AS score, submission.feedback AS feedback
        ORDER BY submission.submittedAt DESC
        """,
        {"assignment_id": assignment_id, "course_id": course_id},
    )


@router.patch("/teacher/courses/{course_id}/assignments/{assignment_id}/submissions/{submission_id}")
def grade_submission(
    course_id: str,
    assignment_id: str,
    submission_id: str,
    request: GradeSubmissionRequest,
    user: TeacherUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    rows = run_read(
        """
        MATCH (submission:Submission {id: $submission_id})-[:FOR_ASSIGNMENT]->(assignment:Assignment {id: $assignment_id})-[:IN_COURSE]->(:Course {id: $course_id})
        RETURN assignment.maxScore AS maxScore
        LIMIT 1
        """,
        {"submission_id": submission_id, "assignment_id": assignment_id, "course_id": course_id},
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bài nộp.")
    if request.score > rows[0]["maxScore"]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Điểm vượt quá điểm tối đa.")
    updated = run_write(
        """
        MATCH (submission:Submission {id: $submission_id})
        SET submission.score = $score, submission.feedback = $feedback,
            submission.status = 'graded', submission.gradedAt = $graded_at
        MATCH (student:User)-[:SUBMITTED]->(submission)
        RETURN submission.id AS id, student.id AS studentId, student.name AS studentName,
               submission.text AS text, submission.submittedAt AS submittedAt,
               submission.status AS status, submission.score AS score, submission.feedback AS feedback
        """,
        {
            "submission_id": submission_id,
            "score": request.score,
            "feedback": request.feedback,
            "graded_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return updated[0]


@router.get("/{role}/courses/{course_id}/announcements")
def get_announcements(
    role: str,
    course_id: str,
    user: CurrentUser,
) -> list[dict[str, Any]]:
    if role not in {"student", "teacher"} or role != user.get("role"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vai trò không có quyền truy cập.")
    _course_access(course_id, user)
    status_filter = "published" if role == "student" else None
    records = run_read(
        """
        MATCH (announcement:Announcement)-[:IN_COURSE]->(course:Course {id: $course_id})
        WHERE $status IS NULL OR announcement.status = $status
        RETURN announcement.id AS id, course.id AS courseId, announcement.title AS title,
               announcement.body AS body, announcement.status AS status,
               coalesce(announcement.isGlobal, false) AS isGlobal,
               coalesce(announcement.authorName, 'Giảng viên') AS authorName,
               announcement.createdAt AS createdAt, announcement.publishedAt AS publishedAt
        ORDER BY announcement.createdAt DESC
        """,
        {"course_id": course_id, "status": status_filter},
    )
    return records


@router.post("/teacher/courses/{course_id}/announcements", status_code=status.HTTP_201_CREATED)
def create_announcement(
    course_id: str,
    request: CreateAnnouncementRequest,
    user: TeacherUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    announcement_id = f"announcement_{uuid4().hex}"
    created_at = datetime.now(timezone.utc).isoformat()
    author_name = str(user.get("name", "Giảng viên"))
    rows = run_write(
        """
        MATCH (course:Course {id: $course_id})
        CREATE (announcement:Announcement {
          id: $id, title: $title, body: $body, status: 'draft',
          isGlobal: false, authorName: $author_name, createdAt: $created_at
        })
        CREATE (announcement)-[:IN_COURSE]->(course)
        RETURN announcement.id AS id
        """,
        {
            "course_id": course_id,
            "id": announcement_id,
            "title": request.title,
            "body": request.body,
            "author_name": author_name,
            "created_at": created_at,
        },
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khóa học.")
    return {
        "id": announcement_id,
        "courseId": course_id,
        "title": request.title,
        "body": request.body,
        "status": "draft",
        "isGlobal": False,
        "authorName": author_name,
        "createdAt": created_at,
    }


@router.patch("/teacher/courses/{course_id}/announcements/{announcement_id}")
def update_announcement(
    course_id: str,
    announcement_id: str,
    request: UpdateAnnouncementRequest,
    user: TeacherUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    existing = run_read(
        """
        MATCH (announcement:Announcement {id: $announcement_id})-[:IN_COURSE]->(course:Course {id: $course_id})
        RETURN properties(announcement) AS announcement
        LIMIT 1
        """,
        {"announcement_id": announcement_id, "course_id": course_id},
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thông báo.")
    current = existing[0]["announcement"]
    new_title = request.title.strip() if request.title is not None else current.get("title", "")
    new_body = request.body.strip() if request.body is not None else current.get("body", "")
    new_status = request.status if request.status is not None else current.get("status", "draft")
    if new_status not in {"draft", "published"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Trạng thái thông báo không hợp lệ.")
    published_at = (
        current.get("publishedAt") or datetime.now(timezone.utc).isoformat()
        if new_status == "published"
        else None
    )
    rows = run_write(
        """
        MATCH (announcement:Announcement {id: $announcement_id})-[:IN_COURSE]->(course:Course {id: $course_id})
        SET announcement.title = $title,
            announcement.body = $body,
            announcement.status = $status,
            announcement.publishedAt = $published_at
        RETURN announcement.id AS id, course.id AS courseId, announcement.title AS title,
               announcement.body AS body, announcement.status AS status,
               coalesce(announcement.isGlobal, false) AS isGlobal,
               coalesce(announcement.authorName, 'Giảng viên') AS authorName,
               announcement.createdAt AS createdAt, announcement.publishedAt AS publishedAt
        """,
        {
            "announcement_id": announcement_id,
            "course_id": course_id,
            "title": new_title,
            "body": new_body,
            "status": new_status,
            "published_at": published_at,
        },
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thông báo.")
    return rows[0]


@router.delete("/teacher/courses/{course_id}/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    course_id: str,
    announcement_id: str,
    user: TeacherUser,
) -> Response:
    _course_access(course_id, user)
    deleted = run_write(
        """
        MATCH (announcement:Announcement {id: $announcement_id})-[:IN_COURSE]->(:Course {id: $course_id})
        DETACH DELETE announcement
        RETURN $announcement_id AS id
        """,
        {"announcement_id": announcement_id, "course_id": course_id},
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thông báo.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

