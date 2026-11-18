from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Role = Literal["student", "teacher", "admin"]


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginRequest(StrictRequest):
    identity: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=256)
    role: Role


class ProfileUpdateRequest(StrictRequest):
    fullName: str = Field(min_length=2, max_length=100)
    dateOfBirth: date | None = None

    @field_validator("fullName")
    @classmethod
    def trim_full_name(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Họ tên phải có ít nhất 2 ký tự.")
        return normalized


class PasswordChangeRequest(StrictRequest):
    currentPassword: str = Field(min_length=1, max_length=256)
    newPassword: str = Field(min_length=8, max_length=256)

    @field_validator("newPassword")
    @classmethod
    def validate_password_policy(cls, value: str) -> str:
        if not any(character.isupper() for character in value) or not any(character.isdigit() for character in value):
            raise ValueError("Mật khẩu cần có ít nhất 1 chữ hoa và 1 chữ số.")
        return value


class AdminCreateUserRequest(StrictRequest):
    email: str = Field(min_length=3, max_length=254)
    fullName: str = Field(min_length=2, max_length=100)
    role: Role
    initialPassword: str = Field(min_length=8, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("Email không hợp lệ.")
        return normalized

    @field_validator("fullName")
    @classmethod
    def trim_full_name(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Họ tên phải có ít nhất 2 ký tự.")
        return normalized

    @field_validator("initialPassword")
    @classmethod
    def validate_password_policy(cls, value: str) -> str:
        if not any(character.isupper() for character in value) or not any(character.isdigit() for character in value):
            raise ValueError("Mật khẩu cần có ít nhất 1 chữ hoa và 1 chữ số.")
        return value


class AdminResetPasswordRequest(StrictRequest):
    temporaryPassword: str = Field(min_length=8, max_length=256)

    @field_validator("temporaryPassword")
    @classmethod
    def validate_password_policy(cls, value: str) -> str:
        if not any(character.isupper() for character in value) or not any(character.isdigit() for character in value):
            raise ValueError("Mật khẩu cần có ít nhất 1 chữ hoa và 1 chữ số.")
        return value


class CreateCourseRequest(StrictRequest):
    code: str = Field(min_length=2, max_length=32)
    title: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=2000)
    faculty: str = Field(default="Khoa Khoa học Máy tính", min_length=2, max_length=120)
    semester: str = Field(default="", max_length=32)
    year: int | None = Field(default=None, ge=2000, le=2200)
    theme: Literal["blue", "green", "orange", "slate"] = "blue"

    @field_validator("code", "title", "description", "faculty", "semester")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()


class UpdateCourseRequest(StrictRequest):
    code: str | None = Field(default=None, min_length=2, max_length=32)
    title: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    faculty: str | None = Field(default=None, min_length=2, max_length=120)
    semester: str | None = Field(default=None, max_length=32)
    year: int | None = Field(default=None, ge=2000, le=2200)
    theme: Literal["blue", "green", "orange", "slate"] | None = None
    published: bool | None = None
    lecturerId: str | None = Field(default=None, max_length=100)


class AdminCourseRequest(StrictRequest):
    code: str = Field(min_length=2, max_length=32)
    title: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=2000)
    faculty: str = Field(default="Khoa Khoa học Máy tính", min_length=2, max_length=120)
    semester: str = Field(default="HK1", max_length=32)
    year: int = Field(default=2026, ge=2000, le=2200)
    theme: Literal["blue", "green", "orange", "slate"] = "blue"
    published: bool = True
    lecturerId: str | None = Field(default=None, max_length=100)

    @field_validator("code", "title", "description", "faculty", "semester")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()


class CreateEnrollmentRequest(StrictRequest):
    studentId: str = Field(min_length=1, max_length=100)
    courseId: str = Field(min_length=1, max_length=100)


class CreateAnnouncementRequest(StrictRequest):
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=5000)

    @field_validator("title", "body")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Trường này không được để trống.")
        return normalized


class UpdateAnnouncementRequest(StrictRequest):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    body: str | None = Field(default=None, min_length=1, max_length=5000)
    status: Literal["draft", "published"] | None = None
    isGlobal: bool | None = None


class AdminAnnouncementRequest(StrictRequest):
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=5000)
    courseId: str | None = Field(default=None, max_length=100)
    isGlobal: bool = True
    status: Literal["draft", "published"] = "published"

    @field_validator("title", "body")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Trường này không được để trống.")
        return normalized


class StatusUpdateRequest(StrictRequest):
    status: str = Field(min_length=1, max_length=32)


class CreateAssignmentRequest(StrictRequest):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=5000)
    dueAt: datetime
    maxScore: float = Field(ge=0.5, le=1000)

    @field_validator("dueAt")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("dueAt phải bao gồm múi giờ.")
        return value

    @field_validator("maxScore")
    @classmethod
    def score_increment(cls, value: float) -> float:
        if not (value * 2).is_integer():
            raise ValueError("maxScore phải tăng theo bước 0.5.")
        return value


class UpdateAssignmentRequest(StrictRequest):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    dueAt: datetime | None = None
    maxScore: float | None = Field(default=None, ge=0.5, le=1000)
    status: Literal["draft", "published", "closed"] | None = None

    @field_validator("dueAt")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("dueAt phải bao gồm múi giờ.")
        return value

    @field_validator("maxScore")
    @classmethod
    def score_increment(cls, value: float | None) -> float | None:
        if value is not None and not (value * 2).is_integer():
            raise ValueError("maxScore phải tăng theo bước 0.5.")
        return value


class UpdateGradebookRowRequest(StrictRequest):
    midterm: float | None = Field(default=None, ge=0, le=10)
    project: float | None = Field(default=None, ge=0, le=10)
    final: float | None = Field(default=None, ge=0, le=10)
    attendance: float | None = Field(default=None, ge=0, le=100)



class SubmitAssignmentRequest(StrictRequest):
    text: str = Field(min_length=1, max_length=50000)

    @field_validator("text")
    @classmethod
    def trim_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Nội dung bài nộp không được để trống.")
        return normalized


class CreateAttendanceSessionRequest(StrictRequest):
    title: str = Field(min_length=1, max_length=160)
    date: date


class AttendanceRecordRequest(StrictRequest):
    studentId: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    status: Literal["unmarked", "present", "absent", "late", "excused"]
    note: str | None = Field(default=None, max_length=500)


class UpdateAttendanceSessionRequest(StrictRequest):
    records: list[AttendanceRecordRequest]
    status: Literal["draft", "published"]


class GradeSubmissionRequest(StrictRequest):
    score: float = Field(ge=0, le=1000)
    feedback: str | None = Field(default=None, max_length=5000)


class QuizOptionRequest(StrictRequest):
    id: str = Field(min_length=1, max_length=40)
    text: str = Field(min_length=1, max_length=500)

    @field_validator("id", "text")
    @classmethod
    def trim_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("ID và nội dung lựa chọn không được để trống.")
        return normalized


class QuizQuestionRequest(StrictRequest):
    id: str = Field(min_length=1, max_length=40)
    prompt: str = Field(min_length=1, max_length=2000)
    options: list[QuizOptionRequest] = Field(min_length=4, max_length=4)
    correctOptionId: str = Field(min_length=1, max_length=40)

    @field_validator("id", "prompt", "correctOptionId")
    @classmethod
    def trim_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("ID câu hỏi và nội dung không được để trống.")
        return normalized

    @field_validator("options")
    @classmethod
    def validate_option_ids(cls, value: list[QuizOptionRequest]) -> list[QuizOptionRequest]:
        if len({option.id for option in value}) != 4:
            raise ValueError("Mỗi lựa chọn trong câu hỏi phải có ID riêng.")
        if any(not option.text for option in value):
            raise ValueError("Nội dung lựa chọn không được để trống.")
        return value

    @model_validator(mode="after")
    def correct_option_exists(self) -> "QuizQuestionRequest":
        if self.correctOptionId not in {option.id for option in self.options}:
            raise ValueError("correctOptionId phải trỏ đến một lựa chọn của câu hỏi.")
        return self


class CreateQuizRequest(StrictRequest):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=5000)
    timeLimitMinutes: int = Field(ge=1, le=300)
    attemptsAllowed: int = Field(ge=1, le=20)
    questions: list[QuizQuestionRequest] = Field(min_length=1, max_length=100)

    @field_validator("title")
    @classmethod
    def trim_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Tên quiz không được để trống.")
        return normalized

    @field_validator("questions")
    @classmethod
    def validate_question_ids(cls, value: list[QuizQuestionRequest]) -> list[QuizQuestionRequest]:
        if len({question.id for question in value}) != len(value):
            raise ValueError("ID câu hỏi phải là duy nhất trong một quiz.")
        option_ids = [
            option.id
            for question in value
            for option in question.options
        ]
        if len(set(option_ids)) != len(option_ids):
            raise ValueError("ID lựa chọn phải là duy nhất trong một quiz.")
        return value


class SubmitQuizRequest(StrictRequest):
    answers: dict[str, str]


class CreateConversationRequest(StrictRequest):
    recipientId: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=4000)

    @field_validator("message")
    @classmethod
    def trim_message(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Tin nhắn không được để trống.")
        return normalized


class SendMessageRequest(StrictRequest):
    body: str = Field(min_length=1, max_length=4000)

    @field_validator("body")
    @classmethod
    def trim_body(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Tin nhắn không được để trống.")
        return normalized


class CreateGraphNodeRequest(StrictRequest):
    name: str = Field(min_length=1, max_length=160)
    nodeType: Literal["Course", "LO", "Concept", "Assignment", "Item", "Content"] = "Concept"
    clusterId: str | None = Field(default=None, max_length=100)
    description: str = Field(default="", max_length=2000)
    x: float = 0
    y: float = 0
    lo: list[str] = Field(default_factory=list)
    properties: dict[str, object] = Field(default_factory=dict)

    @field_validator("name", "description")
    @classmethod
    def trim_graph_text(cls, value: str) -> str:
        return value.strip()


class UpdateGraphNodeRequest(StrictRequest):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    status: Literal["approved", "draft", "pending_review", "outside_cluster", "proposed"] | None = None
    approved: bool | None = None
    x: float | None = None
    y: float | None = None
    lo: list[str] | None = None
    properties: dict[str, object] | None = None


class CreateGraphEdgeRequest(StrictRequest):
    fromId: str = Field(min_length=1, max_length=100)
    toId: str = Field(min_length=1, max_length=100)
    kind: Literal[
        "prereq",
        "related",
        "concept",
        "PREREQUISITE",
        "PART_OF",
        "RELATED_TO",
        "DEVELOP",
        "EXPLAIN",
        "ASSESS",
    ] = "PREREQUISITE"
    clusterId: str | None = Field(default=None, max_length=100)
    properties: dict[str, object] = Field(default_factory=dict)


class DeleteGraphEdgeRequest(StrictRequest):
    fromId: str = Field(min_length=1, max_length=100)
    toId: str = Field(min_length=1, max_length=100)
    edgeType: str | None = Field(default=None, max_length=40)
    clusterId: str | None = Field(default=None, max_length=100)


class ApproveGraphEdgeRequest(StrictRequest):
    fromId: str = Field(min_length=1, max_length=100)
    toId: str = Field(min_length=1, max_length=100)
    edgeType: str | None = Field(default=None, max_length=40)


class MergeGraphNodesRequest(StrictRequest):
    keepId: str = Field(min_length=1, max_length=100)
    mergeId: str = Field(min_length=1, max_length=100)
    clusterId: str | None = Field(default=None, max_length=100)

