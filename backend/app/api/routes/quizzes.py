from datetime import datetime, timedelta, timezone
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import require_roles
from app.api.routes.courses import _course_access
from app.domain.models.api import CreateQuizRequest, StatusUpdateRequest, SubmitQuizRequest
from app.infrastructure.neo4j.driver import run_read, run_write

router = APIRouter(tags=["Quizzes"])
StudentUser = Annotated[dict[str, Any], Depends(require_roles("student"))]
TeacherUser = Annotated[dict[str, Any], Depends(require_roles("teacher"))]


def _quiz_records(course_id: str, student_id: str | None) -> list[dict[str, Any]]:
    return run_read(
        """
        MATCH (quiz:Quiz)-[:IN_COURSE]->(course:Course {id: $course_id})
        WHERE $student_id IS NULL OR quiz.status = 'published'
        OPTIONAL MATCH (question:QuizQuestion)-[:PART_OF]->(quiz)
        WITH quiz, question
        ORDER BY question.sequence
        WITH quiz, collect(CASE WHEN question IS NULL THEN null ELSE {
          id: question.id, prompt: question.prompt, optionIds: question.optionIds,
          optionTexts: question.optionTexts, correctOptionId: question.correctOptionId
        } END) AS questions
        OPTIONAL MATCH (student:User {id: $student_id})-[:ATTEMPTED]->(attempt:QuizAttempt)-[:FOR_QUIZ]->(quiz)
        RETURN quiz.id AS id, course.id AS courseId, quiz.title AS title,
               coalesce(quiz.description, '') AS description,
               quiz.timeLimitMinutes AS timeLimitMinutes,
               quiz.attemptsAllowed AS attemptsAllowed,
               count(attempt) AS attemptsUsed,
               quiz.status AS status, questions AS questions
        ORDER BY quiz.title
        """,
        {"course_id": course_id, "student_id": student_id},
    )


def _serialize_quiz(record: dict[str, Any], include_answer_key: bool) -> dict[str, Any]:
    questions = []
    for question in record["questions"]:
        if question is None:
            continue
        options = [
            {"id": option_id, "text": question["optionTexts"][index]}
            for index, option_id in enumerate(question["optionIds"])
        ]
        serialized = {"id": question["id"], "prompt": question["prompt"], "options": options}
        if include_answer_key:
            serialized["correctOptionId"] = question["correctOptionId"]
        questions.append(serialized)
    return {
        "id": record["id"],
        "courseId": record["courseId"],
        "title": record["title"],
        "description": record["description"],
        "timeLimitMinutes": record["timeLimitMinutes"],
        "attemptsAllowed": record["attemptsAllowed"],
        "attemptsUsed": record["attemptsUsed"],
        "status": record["status"],
        "questions": questions,
    }


def _quiz_record(course_id: str, quiz_id: str, student_id: str | None) -> dict[str, Any]:
    records = [
        record for record in _quiz_records(course_id, student_id)
        if record["id"] == quiz_id
    ]
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy quiz.")
    return records[0]


@router.get("/student/courses/{course_id}/quizzes")
def get_student_quizzes(course_id: str, user: StudentUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    return [_serialize_quiz(record, False) for record in _quiz_records(course_id, str(user["id"]))]


@router.get("/teacher/courses/{course_id}/quizzes")
def get_teacher_quizzes(course_id: str, user: TeacherUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    return [_serialize_quiz(record, True) for record in _quiz_records(course_id, None)]


@router.post("/teacher/courses/{course_id}/quizzes", status_code=status.HTTP_201_CREATED)
def create_quiz(course_id: str, request: CreateQuizRequest, user: TeacherUser) -> dict[str, Any]:
    _course_access(course_id, user)
    quiz_id = f"quiz_{uuid4().hex}"
    questions = [
        {
            "id": question.id,
            "prompt": question.prompt,
            "optionIds": [option.id for option in question.options],
            "optionTexts": [option.text for option in question.options],
            "correctOptionId": question.correctOptionId,
            "sequence": index,
        }
        for index, question in enumerate(request.questions)
    ]
    rows = run_write(
        """
        MATCH (course:Course {id: $course_id})
        CREATE (quiz:Quiz {
          id: $quiz_id, title: $title, description: $description,
          timeLimitMinutes: $time_limit, attemptsAllowed: $attempts_allowed,
          status: 'draft', createdAt: $created_at
        })
        CREATE (quiz)-[:IN_COURSE]->(course)
        WITH quiz
        UNWIND $questions AS item
        CREATE (question:QuizQuestion {
          id: item.id, prompt: item.prompt, optionIds: item.optionIds,
          optionTexts: item.optionTexts, correctOptionId: item.correctOptionId,
          sequence: item.sequence
        })
        CREATE (question)-[:PART_OF]->(quiz)
        RETURN quiz.id AS id
        """,
        {
            "course_id": course_id,
            "quiz_id": quiz_id,
            "title": request.title,
            "description": request.description,
            "time_limit": request.timeLimitMinutes,
            "attempts_allowed": request.attemptsAllowed,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "questions": questions,
        },
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khóa học.")
    return {
        "id": quiz_id,
        "courseId": course_id,
        "title": request.title,
        "description": request.description,
        "timeLimitMinutes": request.timeLimitMinutes,
        "attemptsAllowed": request.attemptsAllowed,
        "attemptsUsed": 0,
        "status": "draft",
        "questions": [
            {
                "id": question.id,
                "prompt": question.prompt,
                "options": [{"id": option.id, "text": option.text} for option in question.options],
                "correctOptionId": question.correctOptionId,
            }
            for question in request.questions
        ],
    }


@router.patch("/teacher/courses/{course_id}/quizzes/{quiz_id}")
def update_quiz_status(
    course_id: str,
    quiz_id: str,
    request: StatusUpdateRequest,
    user: TeacherUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    if request.status not in {"published", "closed"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Trạng thái quiz không hợp lệ.")
    rows = run_read(
        """
        MATCH (quiz:Quiz {id: $quiz_id})-[:IN_COURSE]->(:Course {id: $course_id})
        RETURN quiz.status AS status
        LIMIT 1
        """,
        {"quiz_id": quiz_id, "course_id": course_id},
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy quiz.")
    current = rows[0]["status"]
    allowed = (current == "draft" and request.status == "published") or (
        current == "published" and request.status == "closed"
    ) or (current == "closed" and request.status == "published")
    if not allowed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Không thể chuyển quiz sang trạng thái này.")
    run_write(
        """
        MATCH (quiz:Quiz {id: $quiz_id})-[:IN_COURSE]->(:Course {id: $course_id})
        SET quiz.status = $status
        RETURN quiz.id AS id
        """,
        {"quiz_id": quiz_id, "course_id": course_id, "status": request.status},
    )
    return _serialize_quiz(_quiz_record(course_id, quiz_id, None), True)


@router.get("/student/courses/{course_id}/quizzes/{quiz_id}")
def get_student_quiz(course_id: str, quiz_id: str, user: StudentUser) -> dict[str, Any]:
    _course_access(course_id, user)
    return _serialize_quiz(_quiz_record(course_id, quiz_id, str(user["id"])), False)


@router.post("/student/courses/{course_id}/quizzes/{quiz_id}/attempts", status_code=status.HTTP_201_CREATED)
def start_quiz_attempt(course_id: str, quiz_id: str, user: StudentUser) -> dict[str, Any]:
    _course_access(course_id, user)
    quiz = run_read(
        """
        MATCH (quiz:Quiz {id: $quiz_id})-[:IN_COURSE]->(:Course {id: $course_id})
        RETURN quiz.status AS status, quiz.attemptsAllowed AS attemptsAllowed,
               quiz.timeLimitMinutes AS timeLimitMinutes, count {
                 (:User {id: $student_id})-[:ATTEMPTED]->(:QuizAttempt)-[:FOR_QUIZ]->(quiz)
               } AS used,
               count { (:QuizQuestion)-[:PART_OF]->(quiz) } AS questions
        """,
        {"quiz_id": quiz_id, "course_id": course_id, "student_id": user["id"]},
    )
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy quiz.")
    data = quiz[0]
    if data["status"] != "published":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Quiz chưa mở hoặc đã đóng.")
    if data["used"] >= data["attemptsAllowed"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bạn đã dùng hết số lượt làm quiz.")
    attempt_id = f"attempt_{uuid4().hex}"
    started_at = datetime.now(timezone.utc)
    expires_at = started_at + timedelta(minutes=data["timeLimitMinutes"])
    created = run_write(
        """
        MATCH (student:User {id: $student_id})
        MATCH (quiz:Quiz {id: $quiz_id})-[:IN_COURSE]->(:Course {id: $course_id})
        WHERE quiz.status = 'published'
        SET student.quizAttemptLock = coalesce(student.quizAttemptLock, 0) + 1
        WITH student, quiz
        OPTIONAL MATCH (student)-[:ATTEMPTED]->(existing:QuizAttempt)-[:FOR_QUIZ]->(quiz)
        WITH student, quiz, count(existing) AS attempts_used
        WHERE attempts_used < quiz.attemptsAllowed
        MATCH (question:QuizQuestion)-[:PART_OF]->(quiz)
        WITH student, quiz, count(question) AS question_count
        CREATE (attempt:QuizAttempt {
          id: $attempt_id, startedAt: $started_at, expiresAt: $expires_at,
          maxScore: question_count, totalQuestions: question_count,
          status: 'in_progress'
        })
        CREATE (student)-[:ATTEMPTED]->(attempt)
        CREATE (attempt)-[:FOR_QUIZ]->(quiz)
        RETURN attempt.id AS id, question_count AS questionCount
        """,
        {
            "student_id": user["id"],
            "quiz_id": quiz_id,
            "course_id": course_id,
            "attempt_id": attempt_id,
            "started_at": started_at.isoformat(),
            "expires_at": expires_at.isoformat(),
        },
    )
    if not created:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Quiz đã đóng hoặc bạn đã dùng hết số lượt làm.")
    return {
        "id": attempt_id,
        "quizId": quiz_id,
        "startedAt": started_at.isoformat(),
        "expiresAt": expires_at.isoformat(),
        "maxScore": created[0]["questionCount"],
        "totalQuestions": created[0]["questionCount"],
    }


@router.post("/student/courses/{course_id}/quizzes/{quiz_id}/attempts/{attempt_id}/submit")
def submit_quiz_attempt(
    course_id: str,
    quiz_id: str,
    attempt_id: str,
    request: SubmitQuizRequest,
    user: StudentUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    rows = run_read(
        """
        MATCH (student:User {id: $student_id})-[:ATTEMPTED]->(attempt:QuizAttempt {id: $attempt_id})-[:FOR_QUIZ]->(quiz:Quiz {id: $quiz_id})-[:IN_COURSE]->(:Course {id: $course_id})
        WHERE attempt.status = 'in_progress'
        OPTIONAL MATCH (question:QuizQuestion)-[:PART_OF]->(quiz)
        RETURN properties(attempt) AS attempt,
               collect(CASE WHEN question IS NULL THEN null ELSE {
                 id: question.id, correctOptionId: question.correctOptionId
               } END) AS questions
        LIMIT 1
        """,
        {
            "student_id": user["id"],
            "attempt_id": attempt_id,
            "quiz_id": quiz_id,
            "course_id": course_id,
        },
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lượt làm đang hoạt động.")
    attempt = rows[0]["attempt"]
    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(str(attempt["expiresAt"]).replace("Z", "+00:00"))
    if now > expires_at:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Thời gian làm quiz đã hết.")
    questions = [question for question in rows[0]["questions"] if question is not None]
    question_map = {question["id"]: question["correctOptionId"] for question in questions}
    if any(question_id not in question_map for question_id in request.answers):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Câu trả lời chứa ID câu hỏi không thuộc quiz.")
    valid_options = run_read(
        """
        MATCH (question:QuizQuestion)-[:PART_OF]->(:Quiz {id: $quiz_id})
        RETURN question.id AS questionId, question.optionIds AS optionIds
        """,
        {"quiz_id": quiz_id},
    )
    options_by_question = {item["questionId"]: item["optionIds"] for item in valid_options}
    if any(
        option_id not in options_by_question.get(question_id, [])
        for question_id, option_id in request.answers.items()
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Câu trả lời chứa lựa chọn không thuộc câu hỏi.")
    correct_count = sum(
        1 for question_id, correct_option in question_map.items()
        if request.answers.get(question_id) == correct_option
    )
    submitted_at = now.isoformat()
    responses = [
        {
            "id": f"response_{uuid4().hex}",
            "questionId": question_id,
            "selectedOptionId": request.answers.get(question_id),
            "isCorrect": request.answers.get(question_id) == correct_option,
        }
        for question_id, correct_option in question_map.items()
        if request.answers.get(question_id) is not None
    ]
    updated = run_write(
        """
        MATCH (attempt:QuizAttempt {id: $attempt_id})
        SET attempt.status = 'submitted', attempt.submittedAt = $submitted_at,
            attempt.score = $score, attempt.correctCount = $correct_count
        WITH attempt
        FOREACH (response IN $responses |
          CREATE (result:QuizResponse {
            id: response.id, questionId: response.questionId,
            selectedOptionId: response.selectedOptionId, isCorrect: response.isCorrect
          })
          CREATE (attempt)-[:HAS_RESPONSE]->(result)
        )
        RETURN attempt.id AS id
        """,
        {
            "attempt_id": attempt_id,
            "submitted_at": submitted_at,
            "score": correct_count,
            "correct_count": correct_count,
            "responses": responses,
        },
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lượt làm.")
    return {
        "id": attempt_id,
        "quizId": quiz_id,
        "startedAt": attempt["startedAt"],
        "expiresAt": attempt["expiresAt"],
        "submittedAt": submitted_at,
        "score": correct_count,
        "maxScore": len(questions),
        "correctCount": correct_count,
        "totalQuestions": len(questions),
    }
