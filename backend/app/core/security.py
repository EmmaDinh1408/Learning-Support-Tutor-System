from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from jwt import InvalidTokenError

from app.core.config import get_settings

_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (InvalidHashError, VerificationError, VerifyMismatchError):
        return False


def create_access_token(
    user_id: str,
    role: str,
    password_reset_required: bool,
    auth_version: int = 0,
) -> tuple[str, str, datetime]:
    settings = get_settings()
    if len(settings.jwt_secret_key) < 32:
        raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters.")
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=settings.access_token_expire_minutes)
    token_id = str(uuid4())
    token = jwt.encode(
        {
            "sub": user_id,
            "role": role,
            "password_reset_required": password_reset_required,
            "ver": auth_version,
            "jti": token_id,
            "iat": issued_at,
            "exp": expires_at,
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return token, token_id, expires_at


def decode_access_token(token: str) -> dict[str, object]:
    settings = get_settings()
    if len(settings.jwt_secret_key) < 32:
        raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters.")
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def create_file_download_token(file_id: str, user_id: str) -> str:
    settings = get_settings()
    if len(settings.jwt_secret_key) < 32:
        raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters.")
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "file_id": file_id,
            "scope": "file:read",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


__all__ = [
    "InvalidTokenError",
    "create_access_token",
    "create_file_download_token",
    "decode_access_token",
    "hash_password",
    "verify_password",
]