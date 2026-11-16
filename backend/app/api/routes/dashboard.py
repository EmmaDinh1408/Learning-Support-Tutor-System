from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.infrastructure.neo4j.driver import run_read

router = APIRouter(tags=["Dashboard and public content"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


DEFAULT_SLIDES = [
    {
        "id": "guide",
        "titleVi": "Hướng dẫn sử dụng hệ thống",
        "titleEn": "System user guide",
        "subtitleVi": "Dành cho Giảng viên & Sinh viên",
        "subtitleEn": "For lecturers and students",
        "linkVi": "Xem chi tiết",
        "linkEn": "View details",
        "imageUrl": "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?q=80&w=1600&auto=format&fit=crop",
    },
    {
        "id": "activities",
        "titleVi": "Thông tin Hoạt động Sinh viên",
        "titleEn": "Student Activities",
        "subtitleVi": "Student Affairs & Ngoại khóa 2026",
        "subtitleEn": "Student affairs and extracurricular activities",
        "linkVi": "Khám phá ngay",
        "linkEn": "Explore now",
        "imageUrl": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1600&auto=format&fit=crop",
    },
    {
        "id": "academic",
        "titleVi": "Thông báo Học vụ & Đăng ký môn",
        "titleEn": "Academic Notices & Course Registration",
        "subtitleVi": "Kế hoạch đào tạo và thời khóa biểu học kỳ mới",
        "subtitleEn": "Academic plan and the new semester timetable",
        "linkVi": "Xem lịch trình",
        "linkEn": "View schedule",
        "imageUrl": "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?q=80&w=1600&auto=format&fit=crop",
    },
]

DEFAULT_STATS = [
    {"value": "12,400+", "labelVi": "Học viên", "labelEn": "Learners"},
    {"value": "380", "labelVi": "Khóa học", "labelEn": "Courses"},
    {"value": "98%", "labelVi": "Hoàn thành", "labelEn": "Completion"},
]


@router.get("/home/slides")
def get_home_slides() -> list[dict[str, str]]:
    slides = run_read(
        """
        MATCH (slide:HomeSlide)
        RETURN slide.id AS id, slide.titleVi AS titleVi, slide.titleEn AS titleEn,
               slide.subtitleVi AS subtitleVi, slide.subtitleEn AS subtitleEn,
               slide.linkVi AS linkVi, slide.linkEn AS linkEn, slide.imageUrl AS imageUrl
        ORDER BY coalesce(slide.sequence, 0)
        """
    )
    return slides if slides else DEFAULT_SLIDES


@router.get("/home/login-stats")
def get_login_stats() -> list[dict[str, str]]:
    stats = run_read(
        """
        MATCH (stat:LoginStat)
        RETURN stat.value AS value, stat.labelVi AS labelVi, stat.labelEn AS labelEn
        ORDER BY coalesce(stat.sequence, 0)
        """
    )
    return stats if stats else DEFAULT_STATS


@router.get("/home/announcements")
def get_home_announcements(user: CurrentUser) -> list[dict[str, Any]]:
    role = user.get("role")
    if role == "student":
        return run_read(
            """
            MATCH (announcement:Announcement)
            WHERE announcement.status = 'published'
              AND (announcement.isGlobal = true OR EXISTS {
                MATCH (:User {id: $user_id})-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(course:Course)<-[:IN_COURSE]-(announcement)
              })
            OPTIONAL MATCH (announcement)-[:IN_COURSE]->(course:Course)
            RETURN announcement.id AS id,
                   course.id AS courseId,
                   coalesce(course.code + ' - ' + course.title, 'Nhà trường') AS courseName,
                   announcement.title AS title,
                   announcement.body AS body,
                   announcement.status AS status,
                   coalesce(announcement.isGlobal, course IS NULL) AS isGlobal,
                   coalesce(announcement.authorName, 'Nhà trường') AS authorName,
                   announcement.createdAt AS createdAt,
                   announcement.publishedAt AS publishedAt
            ORDER BY announcement.createdAt DESC
            LIMIT 10
            """,
            {"user_id": user["id"]},
        )
    if role == "teacher":
        return run_read(
            """
            MATCH (announcement:Announcement)
            WHERE announcement.isGlobal = true OR EXISTS {
              MATCH (:User {id: $user_id})-[:TEACHES]->(course:Course)<-[:IN_COURSE]-(announcement)
            }
            OPTIONAL MATCH (announcement)-[:IN_COURSE]->(course:Course)
            RETURN announcement.id AS id,
                   course.id AS courseId,
                   coalesce(course.code + ' - ' + course.title, 'Nhà trường') AS courseName,
                   announcement.title AS title,
                   announcement.body AS body,
                   announcement.status AS status,
                   coalesce(announcement.isGlobal, course IS NULL) AS isGlobal,
                   coalesce(announcement.authorName, 'Nhà trường') AS authorName,
                   announcement.createdAt AS createdAt,
                   announcement.publishedAt AS publishedAt
            ORDER BY announcement.createdAt DESC
            LIMIT 10
            """,
            {"user_id": user["id"]},
        )
    return run_read(
        """
        MATCH (announcement:Announcement)
        OPTIONAL MATCH (announcement)-[:IN_COURSE]->(course:Course)
        RETURN announcement.id AS id,
               course.id AS courseId,
               coalesce(course.code + ' - ' + course.title, 'Nhà trường') AS courseName,
               announcement.title AS title,
               announcement.body AS body,
               announcement.status AS status,
               coalesce(announcement.isGlobal, course IS NULL) AS isGlobal,
               coalesce(announcement.authorName, 'Nhà trường') AS authorName,
               announcement.createdAt AS createdAt,
               announcement.publishedAt AS publishedAt
        ORDER BY announcement.createdAt DESC
        LIMIT 10
        """
    )



@router.get("/dashboard")
def get_dashboard(user: CurrentUser) -> dict[str, list[dict[str, Any]]]:
    if user.get("role") == "student":
        rows = run_read(
            """
            MATCH (student:User {id: $user_id})-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(course:Course)
            MATCH (assignment:Assignment)-[:IN_COURSE]->(course)
            WHERE assignment.status = 'published'
            RETURN assignment.id AS id, assignment.title AS title, assignment.dueAt AS dueAt,
                   course.id AS courseId, course.code AS courseCode,
                   coalesce(assignment.description, '') AS description, 'assignment' AS type
            UNION ALL
            MATCH (student:User {id: $user_id})-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(course:Course)
            MATCH (quiz:Quiz)-[:IN_COURSE]->(course)
            WHERE quiz.status = 'published' AND quiz.dueAt IS NOT NULL
            RETURN quiz.id AS id, quiz.title AS title, quiz.dueAt AS dueAt,
                   course.id AS courseId, course.code AS courseCode,
                   coalesce(quiz.description, '') AS description, 'quiz' AS type
            """,
            {"user_id": user["id"]},
        )
    elif user.get("role") == "teacher":
        rows = run_read(
            """
            MATCH (:User {id: $user_id})-[:TEACHES]->(course:Course)
            MATCH (assignment:Assignment)-[:IN_COURSE]->(course)
            WHERE assignment.status = 'published'
            RETURN assignment.id AS id, assignment.title AS title, assignment.dueAt AS dueAt,
                   course.id AS courseId, course.code AS courseCode,
                   coalesce(assignment.description, '') AS description, 'assignment' AS type
            UNION ALL
            MATCH (:User {id: $user_id})-[:TEACHES]->(course:Course)
            MATCH (session:AttendanceSession)-[:IN_COURSE]->(course)
            RETURN session.id AS id, session.title AS title, session.date AS dueAt,
                   course.id AS courseId, course.code AS courseCode, '' AS description, 'class' AS type
            """,
            {"user_id": user["id"]},
        )
    else:
        rows = []

    activities = [
        {
            "id": row["id"],
            "dueAt": row["dueAt"],
            "title": row["title"],
            "courseId": row["courseId"],
            "courseCode": row["courseCode"],
            "description": row["description"],
            "type": row["type"],
            "targetId": row["id"],
        }
        for row in rows
        if row.get("dueAt")
    ]
    calendar_events = [
        {
            "id": activity["id"],
            "date": str(activity["dueAt"])[:10],
            "title": f"{activity['title']} · {activity['courseCode']}",
            "type": "warning" if activity["type"] in {"assignment", "quiz"} else "info",
            "courseCode": activity["courseCode"],
        }
        for activity in activities
    ]
    return {"activities": activities, "calendarEvents": calendar_events}
