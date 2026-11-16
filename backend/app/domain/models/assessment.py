from pydantic import BaseModel, Field


class GradebookEntry(BaseModel):
    studentId: str
    name: str
    status: str = "active"
    progress: int = Field(default=0, ge=0, le=100)
    midterm: float | None = None
    project: float | None = None
    final: float | None = None
    attendance: float | None = None
    totalScore: float | None = None
