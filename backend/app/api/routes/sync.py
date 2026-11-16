from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.api.dependencies import require_roles
from app.api.routes.courses import _course_access
from app.application.services.synchronization_service import recalculate_student_course_progress

router = APIRouter(tags=["Synchronization"])
StudentUser = Annotated[dict[str, Any], Depends(require_roles("student"))]


@router.post("/student/courses/{course_id}/sync-progress")
def sync_student_progress(course_id: str, user: StudentUser) -> dict[str, Any]:
    _course_access(course_id, user)
    return recalculate_student_course_progress(str(user["id"]), course_id)
