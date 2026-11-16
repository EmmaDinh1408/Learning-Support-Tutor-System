import pytest
from pydantic import ValidationError

from app.core import security
from app.core.config import Settings
from app.domain.models.api import CreateQuizRequest, ProfileUpdateRequest, QuizQuestionRequest


def test_password_hash_is_verified_without_storing_plaintext() -> None:
    password = "StrongPassword9"
    password_hash = security.hash_password(password)

    assert password_hash != password
    assert security.verify_password(password, password_hash)
    assert not security.verify_password("WrongPassword9", password_hash)
    assert not security.verify_password(password, "invalid-hash")


def test_access_token_contains_user_scope_and_expiry(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(security, "get_settings", lambda: Settings(jwt_secret_key="x" * 40))

    token, token_id, _ = security.create_access_token("usr_1", "student", True, 3)
    claims = security.decode_access_token(token)

    assert claims["sub"] == "usr_1"
    assert claims["role"] == "student"
    assert claims["password_reset_required"] is True
    assert claims["ver"] == 3
    assert claims["jti"] == token_id


def test_profile_update_rejects_role_changes() -> None:
    with pytest.raises(ValidationError):
        ProfileUpdateRequest(fullName="Valid Name", role="admin")


def test_quiz_requires_four_options_and_existing_answer_key() -> None:
    with pytest.raises(ValidationError):
        QuizQuestionRequest(
            id="q1",
            prompt="Question",
            options=[{"id": "a", "text": "A"}],
            correctOptionId="b",
        )
    with pytest.raises(ValidationError):
        QuizQuestionRequest(
            id="q1",
            prompt="Question",
            options=[
                {"id": "a", "text": "A"},
                {"id": "b", "text": "B"},
                {"id": "c", "text": "C"},
                {"id": "d", "text": "D"},
            ],
            correctOptionId="x",
        )


def test_quiz_option_ids_are_unique_across_questions() -> None:
    question = {
        "id": "q1",
        "prompt": "Question",
        "options": [
            {"id": "a", "text": "A"},
            {"id": "b", "text": "B"},
            {"id": "c", "text": "C"},
            {"id": "d", "text": "D"},
        ],
        "correctOptionId": "a",
    }
    with pytest.raises(ValidationError):
        CreateQuizRequest(
            title="Quiz",
            timeLimitMinutes=10,
            attemptsAllowed=1,
            questions=[
                question,
                {
                    **question,
                    "id": "q2",
                    "options": [
                        {"id": "a", "text": "A2"},
                        {"id": "b", "text": "B2"},
                        {"id": "c", "text": "C2"},
                        {"id": "d", "text": "D2"},
                    ],
                },
            ],
        )
