from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import require_roles
from app.api.routes.courses import _course_access
from app.application.services.recommendation_service import build_course_recommendations

router = APIRouter(tags=["Recommendations"])
StudentUser = Annotated[dict[str, Any], Depends(require_roles("student"))]


@router.get("/student/courses/{course_id}/recommendations")
def get_course_recommendations(
    course_id: str,
    user: StudentUser,
    limit: int = Query(default=6, ge=1, le=20),
) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    return build_course_recommendations(str(user["id"]), course_id, limit=limit)
