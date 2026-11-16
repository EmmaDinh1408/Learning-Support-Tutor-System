from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.api.dependencies import require_roles
from app.api.routes.courses import _course_access
from app.infrastructure.neo4j.repositories.student_repository import get_student_learning_profile

router = APIRouter(tags=["Learning profiles"])
StudentUser = Annotated[dict[str, Any], Depends(require_roles("student"))]


@router.get("/student/learning-profile")
def read_student_learning_profile(user: StudentUser, course_id: str | None = None) -> dict[str, Any]:
    if course_id:
        _course_access(course_id, user)
    return get_student_learning_profile(str(user["id"]), course_id)
