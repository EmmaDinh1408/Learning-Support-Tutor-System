from pydantic import BaseModel, Field


class CourseEntity(BaseModel):
    id: str
    code: str
    title: str
    description: str = ""
    faculty: str = "Khoa Khoa học Máy tính"
    semester: str = "HK1"
    year: int = 2026
    theme: str = "blue"
    published: bool = False
    lecturerId: str | None = None
    lecturerName: str | None = None
    students: int = Field(default=0, ge=0)
