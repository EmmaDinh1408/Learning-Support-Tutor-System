import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from jwt import InvalidTokenError

from app.api.dependencies import get_current_user, require_roles
from app.api.routes.courses import _course_access
from app.core.config import get_settings
from app.core.security import create_file_download_token, decode_access_token
from app.infrastructure.neo4j.driver import run_read, run_write
from app.infrastructure.postgres.db import is_postgres_enabled, pg_conn
from app.infrastructure.storage.minio_client import delete_object, get_object_bytes, put_object_bytes

router = APIRouter(tags=["Course files"])
TeacherUser = Annotated[dict[str, Any], Depends(require_roles("teacher"))]
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".mp4", ".mov", ".zip"}
MAX_FILENAME_LENGTH = 200


def _file_record(record: dict[str, Any], user_id: str) -> dict[str, Any]:
    token = create_file_download_token(record["id"], user_id)
    return {
        "id": record["id"],
        "courseId": record["courseId"],
        "name": record["name"],
        "mimeType": record["mimeType"],
        "sizeBytes": record["sizeBytes"],
        "uploadedAt": record["uploadedAt"],
        "pages": 0,
        "sizeMb": round(record["sizeBytes"] / (1024 * 1024), 1),
        "date": str(record["uploadedAt"])[:10],
        "downloadUrl": f"/api/files/{record['id']}?token={quote(token)}",
    }


@router.get("/teacher/courses/{course_id}/documents")
def get_course_files(course_id: str, user: TeacherUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    records = run_read(
        """
        MATCH (file:CourseFile)-[:IN_COURSE]->(:Course {id: $course_id})
        RETURN file.id AS id, file.courseId AS courseId, file.name AS name,
               file.mimeType AS mimeType, file.sizeBytes AS sizeBytes,
               file.uploadedAt AS uploadedAt
        ORDER BY file.uploadedAt DESC
        """,
        {"course_id": course_id},
    )
    return [_file_record(record, str(user["id"])) for record in records]


@router.post("/teacher/courses/{course_id}/documents", status_code=status.HTTP_201_CREATED)
def upload_course_file(
    course_id: str,
    user: TeacherUser,
    file: Annotated[UploadFile, File()],
) -> dict[str, Any]:
    _course_access(course_id, user)
    original_name = Path(file.filename or "").name.strip()
    extension = Path(original_name).suffix.lower()
    if not original_name or len(original_name) > MAX_FILENAME_LENGTH or extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Định dạng hoặc tên tệp không được hỗ trợ.")
    content = file.file.read(get_settings().max_upload_size_bytes + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Tệp không được để trống.")
    if len(content) > get_settings().max_upload_size_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Tệp vượt quá giới hạn 50 MB.")

    file_id = f"file_{uuid4().hex}"
    storage_key = f"{course_id}/{uuid4().hex}{extension}"
    mime_type = mimetypes.guess_type(original_name)[0] or "application/octet-stream"
    uploaded_at = datetime.now(timezone.utc).isoformat()
    put_object_bytes(storage_key, content, content_type=mime_type)

    persisted = False
    try:
        records = run_write(
            """
            MATCH (course:Course {id: $course_id})
            CREATE (file:CourseFile {
              id: $id, courseId: $course_id, name: $name, mimeType: $mime_type,
              sizeBytes: $size_bytes, uploadedAt: $uploaded_at, storageKey: $storage_key
            })
            CREATE (file)-[:IN_COURSE]->(course)
            RETURN file.id AS id, file.courseId AS courseId, file.name AS name,
                   file.mimeType AS mimeType, file.sizeBytes AS sizeBytes,
                   file.uploadedAt AS uploadedAt
            """,
            {
                "course_id": course_id,
                "id": file_id,
                "name": original_name,
                "mime_type": mime_type,
                "size_bytes": len(content),
                "uploaded_at": uploaded_at,
                "storage_key": storage_key,
            },
        )
        if not records:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khóa học.")
        if is_postgres_enabled():
            with pg_conn() as conn:
                conn.execute(
                    """
                    INSERT INTO course_documents (id, course_id, name, mime_type, size_bytes, s3_key, uploaded_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (file_id, course_id, original_name, mime_type, len(content), storage_key, str(user["id"])),
                )
        persisted = True
    finally:
        if not persisted:
            delete_object(storage_key)
    return _file_record(records[0], str(user["id"]))


@router.get("/files/{file_id}")
def download_course_file(
    file_id: str,
    token: str | None = Query(default=None),
    bearer_token: Annotated[str | None, Depends(optional_oauth2_scheme)] = None,
) -> Response:
    records = run_read(
        """
        MATCH (file:CourseFile {id: $file_id})-[:IN_COURSE]->(course:Course)
        RETURN properties(file) AS file, course.id AS courseId
        LIMIT 1
        """,
        {"file_id": file_id},
    )
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tệp.")
    record = records[0]
    if token:
        try:
            claims = decode_access_token(token)
        except InvalidTokenError as error:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Liên kết tải tệp đã hết hạn hoặc không hợp lệ.") from error
        if claims.get("scope") != "file:read" or claims.get("file_id") != file_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Liên kết tải tệp không hợp lệ.")
    elif bearer_token:
        user = get_current_user(bearer_token)
        _course_access(record["courseId"], user)
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cần đăng nhập để tải tệp.")
    storage_key = str(record["file"].get("storageKey", ""))
    if not storage_key or ".." in storage_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Đường dẫn lưu trữ tệp không hợp lệ.")
    try:
        file_bytes = get_object_bytes(storage_key)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nội dung tệp không còn tồn tại.") from error
    filename = str(record["file"]["name"]).replace('"', "")
    return Response(
        content=file_bytes,
        media_type=str(record["file"]["mimeType"]),
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )
