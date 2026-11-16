from typing import Annotated, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt import InvalidTokenError

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.infrastructure.neo4j.driver import run_read

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{get_settings().api_prefix}/auth/login")


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> dict[str, object]:
    try:
        claims = decode_access_token(token)
    except InvalidTokenError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    user_id = claims.get("sub")
    token_id = claims.get("jti")
    if not isinstance(user_id, str) or not isinstance(token_id, str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Thông tin phiên đăng nhập không hợp lệ.")

    revoked = run_read(
        "MATCH (token:RevokedToken {id: $token_id}) RETURN token.id AS id LIMIT 1",
        {"token_id": token_id},
    )
    if revoked:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Phiên đăng nhập đã bị thu hồi.")

    records = run_read(
        "MATCH (user:User {id: $user_id}) RETURN properties(user) AS user LIMIT 1",
        {"user_id": user_id},
    )
    if not records or not records[0]["user"].get("active", True):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tài khoản không tồn tại hoặc đã bị khóa.")
    user = records[0]["user"]
    if claims.get("ver", 0) != user.get("authVersion", 0):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Phiên đăng nhập đã bị thu hồi.")
    return user


def require_roles(*roles: str) -> Callable[..., dict[str, object]]:
    def check_role(user: Annotated[dict[str, object], Depends(get_current_user)]) -> dict[str, object]:
        if user.get("role") not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền thực hiện thao tác này.")
        return user

    return check_role
