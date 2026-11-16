from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import require_roles
from app.core.security import hash_password
from app.domain.models.api import (
    AdminAnnouncementRequest,
    AdminCourseRequest,
    AdminCreateUserRequest,
    AdminResetPasswordRequest,
    CreateEnrollmentRequest,
    UpdateAnnouncementRequest,
    UpdateCourseRequest,
)
from app.infrastructure.neo4j.driver import run_read, run_write
from app.infrastructure.neo4j.repositories.course_repository import (
    delete_course_by_id,
    list_all_courses,
    update_course_properties,
)
from app.infrastructure.neo4j.repositories.user_repository import (
    create_user,
    find_user_by_identity,
    find_user_by_id,
    list_users,
    update_user,
)


router = APIRouter(prefix="/admin", tags=["Administration"])
AdminUser = Annotated[dict[str, Any], Depends(require_roles("admin"))]


def _admin_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "createdAt": user.get("createdAt"),
        "active": bool(user.get("active", True)),
    }


@router.get("/users")
def get_users(_: AdminUser) -> list[dict[str, Any]]:
    return [_admin_user(user) for user in list_users()]


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_account(request: AdminCreateUserRequest, _: AdminUser) -> dict[str, Any]:
    if find_user_by_identity(request.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email đã được sử dụng.")
    now = datetime.now(timezone.utc).isoformat()
    user = create_user(
        {
            "id": f"usr_{uuid4().hex}",
            "email": request.email,
            "name": request.fullName,
            "role": request.role,
            "passwordHash": hash_password(request.initialPassword),
            "passwordResetRequired": True,
            "authVersion": 0,
            "active": True,
            "createdAt": now,
        },
    )
    return _admin_user(user)


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(user_id: str, request: AdminResetPasswordRequest, admin: AdminUser) -> Response:
    if user_id == admin["id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Hãy tự đổi mật khẩu trong hồ sơ tài khoản.")
    target = find_user_by_id(user_id)
    if target is None or not target.get("active", True):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tài khoản đang hoạt động.")
    updated = update_user(
        user_id,
        {
            "passwordHash": hash_password(request.temporaryPassword),
            "passwordResetRequired": True,
            "authVersion": int(target.get("authVersion", 0)) + 1,
        },
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tài khoản.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(user_id: str, admin: AdminUser) -> Response:
    if user_id == admin["id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể tự khóa tài khoản đang đăng nhập.")
    target = find_user_by_id(user_id)
    if target is None or not target.get("active", True):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tài khoản đang hoạt động.")
    if target.get("role") == "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không thể xóa tài khoản quản trị viên.")
    update_user(user_id, {"active": False, "authVersion": int(target.get("authVersion", 0)) + 1})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/enrollments")
def get_enrollments(_: AdminUser) -> dict[str, Any]:
    students = run_read(
        """
        MATCH (student:User {role: 'student', active: true})
        RETURN student.id AS id, student.name AS name, student.email AS email
        ORDER BY student.name
        """
    )
    courses = run_read(
        """
        MATCH (course:Course)
        RETURN course.id AS id, course.code AS code, course.title AS title,
               coalesce(course.semester, '') AS semester, course.year AS year
        ORDER BY course.year DESC, course.code
        """
    )
    enrollments = run_read(
        """
        MATCH (student:User)-[:HAS_ENROLLMENT]->(enrollment:Enrollment)-[:FOR_COURSE]->(course:Course)
        WHERE student.role = 'student'
        RETURN enrollment.id AS id, student.id AS studentId, student.name AS studentName,
               student.email AS studentEmail, course.id AS courseId, course.code AS courseCode,
               course.title AS courseTitle, enrollment.enrolledAt AS enrolledAt,
               coalesce(enrollment.progress, 0) AS progress
        ORDER BY enrollment.enrolledAt DESC
        """
    )
    return {"students": students, "courses": courses, "enrollments": enrollments}


@router.post("/enrollments", status_code=status.HTTP_201_CREATED)
def create_enrollment(request: CreateEnrollmentRequest, _: AdminUser) -> dict[str, Any]:
    found = run_read(
        """
        MATCH (student:User {id: $student_id, role: 'student', active: true})
        MATCH (course:Course {id: $course_id})
        OPTIONAL MATCH (student)-[:HAS_ENROLLMENT]->(existing:Enrollment)-[:FOR_COURSE]->(course)
        RETURN student.id AS studentId, student.name AS studentName, student.email AS studentEmail,
               course.id AS courseId, course.code AS courseCode, course.title AS courseTitle,
               existing.id AS existingId
        LIMIT 1
        """,
        {"student_id": request.studentId, "course_id": request.courseId},
    )
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sinh viên hoặc khóa học.")
    record = found[0]
    if record.get("existingId"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Sinh viên đã được ghi danh khóa học này.")
    enrollment_id = f"enr_{uuid4().hex}"
    enrolled_at = datetime.now(timezone.utc).isoformat()
    run_write(
        """
        MATCH (student:User {id: $student_id})
        MATCH (course:Course {id: $course_id})
        CREATE (student)-[:HAS_ENROLLMENT]->(enrollment:Enrollment {
          id: $enrollment_id, status: 'active', progress: 0, enrolledAt: $enrolled_at
        })-[:FOR_COURSE]->(course)
        RETURN enrollment.id AS id
        """,
        {
            "student_id": request.studentId,
            "course_id": request.courseId,
            "enrollment_id": enrollment_id,
            "enrolled_at": enrolled_at,
        },
    )
    return {
        "id": enrollment_id,
        "studentId": record["studentId"],
        "studentName": record["studentName"],
        "studentEmail": record["studentEmail"],
        "courseId": record["courseId"],
        "courseCode": record["courseCode"],
        "courseTitle": record["courseTitle"],
        "enrolledAt": enrolled_at,
        "progress": 0,
    }


@router.delete("/enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_enrollment(enrollment_id: str, _: AdminUser) -> Response:
    deleted = run_write(
        """
        MATCH (enrollment:Enrollment {id: $enrollment_id})
        DETACH DELETE enrollment
        RETURN $enrollment_id AS id
        """,
        {"enrollment_id": enrollment_id},
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bản ghi ghi danh.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/stats")
def get_admin_stats(_: AdminUser) -> dict[str, Any]:
    counts = run_read(
        """
        CALL {
          OPTIONAL MATCH (s:User {role: 'student', active: true})
          RETURN count(s) AS students
        }
        CALL {
          OPTIONAL MATCH (t:User {role: 'teacher', active: true})
          RETURN count(t) AS teachers
        }
        CALL {
          OPTIONAL MATCH (a:User {role: 'admin', active: true})
          RETURN count(a) AS admins
        }
        CALL {
          OPTIONAL MATCH (c:Course)
          RETURN count(c) AS courses
        }
        CALL {
          OPTIONAL MATCH (e:Enrollment)
          RETURN count(e) AS enrollments
        }
        CALL {
          OPTIONAL MATCH (asg:Assignment)
          RETURN count(asg) AS assignments
        }
        CALL {
          OPTIONAL MATCH (ann:Announcement)
          RETURN count(ann) AS announcements
        }
        RETURN students, teachers, admins, courses, enrollments, assignments, announcements
        """
    )[0]
    teachers = run_read(
        """
        MATCH (teacher:User {role: 'teacher', active: true})
        RETURN teacher.id AS id, teacher.name AS name, teacher.email AS email
        ORDER BY teacher.name
        """
    )
    return {
        **counts,
        "teachersList": teachers,
    }


@router.get("/courses")
def get_admin_courses(_: AdminUser) -> list[dict[str, Any]]:
    return list_all_courses()


@router.post("/courses", status_code=status.HTTP_201_CREATED)
def create_admin_course(request: AdminCourseRequest, _: AdminUser) -> dict[str, Any]:
    duplicate = run_read(
        """
        MATCH (course:Course)
        WHERE toLower(course.code) = toLower($code)
          AND coalesce(course.semester, '') = $semester
          AND coalesce(course.year, 0) = $year
        RETURN course.id AS id LIMIT 1
        """,
        {"code": request.code, "semester": request.semester, "year": request.year},
    )
    if duplicate:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Khóa học với mã và học kỳ này đã tồn tại.")

    course_id = f"course_{uuid4().hex}"
    now = datetime.now(timezone.utc).isoformat()
    properties = {
        "id": course_id,
        "code": request.code,
        "title": request.title,
        "description": request.description,
        "faculty": request.faculty,
        "semester": request.semester,
        "year": request.year,
        "theme": request.theme,
        "published": request.published,
        "createdAt": now,
    }
    run_write(
        """
        CREATE (course:Course $properties)
        WITH course
        OPTIONAL MATCH (teacher:User {id: $lecturer_id, role: 'teacher', active: true})
        FOREACH (_ IN CASE WHEN teacher IS NULL THEN [] ELSE [1] END |
          CREATE (teacher)-[:TEACHES]->(course)
        )
        RETURN course.id AS id
        """,
        {"properties": properties, "lecturer_id": request.lecturerId},
    )
    created = next((c for c in list_all_courses() if c["id"] == course_id), None)
    return created or {**properties, "lecturerId": request.lecturerId, "lecturerName": "", "students": 0}


@router.patch("/courses/{course_id}")
def update_admin_course(course_id: str, request: UpdateCourseRequest, _: AdminUser) -> dict[str, Any]:
    updates: dict[str, Any] = {}
    for field in ("code", "title", "description", "faculty", "semester", "year", "theme", "published"):
        val = getattr(request, field)
        if val is not None:
            updates[field] = val.strip() if isinstance(val, str) else val
    updated = update_course_properties(course_id, updates, request.lecturerId)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khóa học.")
    match = next((c for c in list_all_courses() if c["id"] == course_id), None)
    return match or updated


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_course(course_id: str, _: AdminUser) -> Response:
    if not delete_course_by_id(course_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khóa học.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/announcements")
def get_admin_announcements(_: AdminUser) -> list[dict[str, Any]]:
    return run_read(
        """
        MATCH (announcement:Announcement)
        OPTIONAL MATCH (announcement)-[:IN_COURSE]->(course:Course)
        RETURN announcement.id AS id,
               course.id AS courseId,
               coalesce(course.code + ' - ' + course.title, 'Toàn trường') AS courseName,
               announcement.title AS title,
               announcement.body AS body,
               coalesce(announcement.status, 'published') AS status,
               coalesce(announcement.isGlobal, course IS NULL) AS isGlobal,
               coalesce(announcement.authorName, 'Quản trị viên') AS authorName,
               announcement.createdAt AS createdAt,
               announcement.publishedAt AS publishedAt
        ORDER BY announcement.createdAt DESC
        """
    )


@router.post("/announcements", status_code=status.HTTP_201_CREATED)
def create_admin_announcement(request: AdminAnnouncementRequest, admin: AdminUser) -> dict[str, Any]:
    announcement_id = f"announcement_{uuid4().hex}"
    now = datetime.now(timezone.utc).isoformat()
    published_at = now if request.status == "published" else None
    is_global = request.isGlobal or not request.courseId
    author_name = str(admin.get("name", "Quản trị viên"))
    if is_global:
        run_write(
            """
            CREATE (announcement:Announcement {
              id: $id, title: $title, body: $body, status: $status,
              isGlobal: true, authorName: $author_name,
              createdAt: $created_at, publishedAt: $published_at
            })
            RETURN announcement.id AS id
            """,
            {
                "id": announcement_id,
                "title": request.title,
                "body": request.body,
                "status": request.status,
                "author_name": author_name,
                "created_at": now,
                "published_at": published_at,
            },
        )
        return {
            "id": announcement_id,
            "courseId": None,
            "courseName": "Toàn trường",
            "title": request.title,
            "body": request.body,
            "status": request.status,
            "isGlobal": True,
            "authorName": author_name,
            "createdAt": now,
            "publishedAt": published_at,
        }
    rows = run_write(
        """
        MATCH (course:Course {id: $course_id})
        CREATE (announcement:Announcement {
          id: $id, title: $title, body: $body, status: $status,
          isGlobal: false, authorName: $author_name,
          createdAt: $created_at, publishedAt: $published_at
        })
        CREATE (announcement)-[:IN_COURSE]->(course)
        RETURN course.code + ' - ' + course.title AS courseName
        """,
        {
            "course_id": request.courseId,
            "id": announcement_id,
            "title": request.title,
            "body": request.body,
            "status": request.status,
            "author_name": author_name,
            "created_at": now,
            "published_at": published_at,
        },
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khóa học.")
    return {
        "id": announcement_id,
        "courseId": request.courseId,
        "courseName": rows[0]["courseName"],
        "title": request.title,
        "body": request.body,
        "status": request.status,
        "isGlobal": False,
        "authorName": author_name,
        "createdAt": now,
        "publishedAt": published_at,
    }


@router.patch("/announcements/{announcement_id}")
def update_admin_announcement(
    announcement_id: str,
    request: UpdateAnnouncementRequest,
    _: AdminUser,
) -> dict[str, Any]:
    existing = run_read(
        """
        MATCH (announcement:Announcement {id: $announcement_id})
        OPTIONAL MATCH (announcement)-[:IN_COURSE]->(course:Course)
        RETURN properties(announcement) AS announcement, course.id AS courseId,
               coalesce(course.code + ' - ' + course.title, 'Toàn trường') AS courseName
        LIMIT 1
        """,
        {"announcement_id": announcement_id},
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thông báo.")
    current = existing[0]["announcement"]
    new_title = request.title.strip() if request.title is not None else current.get("title", "")
    new_body = request.body.strip() if request.body is not None else current.get("body", "")
    new_status = request.status if request.status is not None else current.get("status", "published")
    new_global = request.isGlobal if request.isGlobal is not None else bool(current.get("isGlobal", existing[0]["courseId"] is None))
    published_at = (
        current.get("publishedAt") or datetime.now(timezone.utc).isoformat()
        if new_status == "published"
        else None
    )
    run_write(
        """
        MATCH (announcement:Announcement {id: $announcement_id})
        SET announcement.title = $title,
            announcement.body = $body,
            announcement.status = $status,
            announcement.isGlobal = $is_global,
            announcement.publishedAt = $published_at
        RETURN announcement.id AS id
        """,
        {
            "announcement_id": announcement_id,
            "title": new_title,
            "body": new_body,
            "status": new_status,
            "is_global": new_global,
            "published_at": published_at,
        },
    )
    return {
        "id": announcement_id,
        "courseId": existing[0]["courseId"],
        "courseName": existing[0]["courseName"],
        "title": new_title,
        "body": new_body,
        "status": new_status,
        "isGlobal": new_global,
        "authorName": current.get("authorName", "Quản trị viên"),
        "createdAt": current.get("createdAt"),
        "publishedAt": published_at,
    }


@router.delete("/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_announcement(announcement_id: str, _: AdminUser) -> Response:
    deleted = run_write(
        """
        MATCH (announcement:Announcement {id: $announcement_id})
        DETACH DELETE announcement
        RETURN $announcement_id AS id
        """,
        {"announcement_id": announcement_id},
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thông báo.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

