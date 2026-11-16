from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from neo4j.exceptions import ConstraintError

from app.api.dependencies import get_current_user, oauth2_scheme
from app.core.security import (
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.domain.models.api import LoginRequest, PasswordChangeRequest, ProfileUpdateRequest
from app.infrastructure.neo4j.driver import run_write
from app.infrastructure.neo4j.repositories.user_repository import (
    find_user_by_identity,
    update_user,
)

router = APIRouter(tags=["Authentication and profile"])


def _initials(name: str) -> str:
    return "".join(part[0] for part in name.split()[-2:] if part).upper()


def _public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user["id"],
        "name": user["name"],
        "initials": _initials(user["name"]),
        "email": user["email"],
        "role": user["role"],
        "passwordResetRequired": bool(user.get("passwordResetRequired", False)),
    }


def _access_response(user: dict[str, Any]) -> dict[str, Any]:
    token, _, expires_at = create_access_token(
        str(user["id"]),
        str(user["role"]),
        bool(user.get("passwordResetRequired", False)),
        int(user.get("authVersion", 0)),
    )
    return {
        "user": _public_user(user),
        "accessToken": token,
        "expiresAt": expires_at.isoformat(),
    }


@router.post("/auth/login")
def login(request: LoginRequest) -> dict[str, Any]:
    user = find_user_by_identity(request.identity)
    if user is None or not verify_password(request.password, str(user.get("passwordHash", ""))):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email, mã đăng nhập hoặc mật khẩu không đúng.")
    if not user.get("active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản đã bị khóa.")
    if user.get("role") != request.role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vai trò đăng nhập không khớp với tài khoản.")
    return _access_response(user)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: Annotated[str, Depends(oauth2_scheme)]) -> Response:
    try:
        claims = decode_access_token(token)
    except InvalidTokenError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Phiên đăng nhập không hợp lệ.") from error
    token_id = claims.get("jti")
    expiry = claims.get("exp")
    if not isinstance(token_id, str) or not isinstance(expiry, (int, float)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Thông tin phiên đăng nhập không hợp lệ.")
    expires_at = datetime.fromtimestamp(expiry, timezone.utc)
    run_write(
        """
        MERGE (revoked:RevokedToken {id: $token_id})
        SET revoked.expiresAt = $expires_at
        RETURN revoked.id AS id
        """,
        {"token_id": token_id, "expires_at": expires_at},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/profile")
def get_profile(user: Annotated[dict[str, Any], Depends(get_current_user)]) -> dict[str, Any]:
    role = str(user["role"])
    student = role == "student"
    code = user.get("studentCode") if student else user.get("staffCode")
    label_vi = "Khoa" if user.get("faculty") else ("Lớp" if student else "Chức danh")
    label_en = "Faculty" if user.get("faculty") else ("Class" if student else "Title")
    field_value = user.get("faculty") or user.get("classYear") or user.get("title") or "—"
    return {
        "id": code or user["id"],
        "email": user["email"],
        "fullName": user["name"],
        "role": role,
        "dateOfBirth": user.get("dateOfBirth"),
        "studentCode": user.get("studentCode"),
        "staffCode": user.get("staffCode"),
        "faculty": user.get("faculty"),
        "classYear": user.get("classYear"),
        "title": user.get("title"),
        "fieldVi": field_value,
        "fieldEn": field_value,
        "labelVi": label_vi,
        "labelEn": label_en,
        "extra": user.get("classYear") or user.get("title") or "—",
    }


@router.patch("/me/profile")
def update_profile(
    request: ProfileUpdateRequest,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    updated = update_user(
        str(user["id"]),
        {
            "name": request.fullName,
            "dateOfBirth": request.dateOfBirth.isoformat() if request.dateOfBirth else None,
        },
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tài khoản.")
    return get_profile(updated)


@router.post("/auth/change-password")
def change_password(
    request: PasswordChangeRequest,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    if not verify_password(request.currentPassword, str(user.get("passwordHash", ""))):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mật khẩu hiện tại không đúng.")
    if request.currentPassword == request.newPassword:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mật khẩu mới phải khác mật khẩu hiện tại.")
    updated = update_user(
        str(user["id"]),
        {
            "passwordHash": hash_password(request.newPassword),
            "passwordResetRequired": False,
            "authVersion": int(user.get("authVersion", 0)) + 1,
        },
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tài khoản.")
    return _access_response(updated)
