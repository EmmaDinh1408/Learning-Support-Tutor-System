import pytest
from fastapi import HTTPException

from app.api.routes.courses import _course_access


def test_course_access_denies_unrelated_student(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.routes.courses.run_read",
        lambda query, params=None: [
            {"course": {"id": "CO3093", "code": "CO3093"}, "enrollmentId": None, "teacherId": None}
        ],
    )
    with pytest.raises(HTTPException) as exc_info:
        _course_access("CO3093", {"id": "usr_student_2", "role": "student"})
    assert exc_info.value.status_code == 403
