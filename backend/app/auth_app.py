from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional

import jwt
from flask import current_app, g, request


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 401):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class AuthedUser:
    id: str
    email: str
    role: str


def _extract_bearer_token() -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise AuthError("Missing Authorization Bearer token", 401)
    return auth_header[len("Bearer ") :].strip()


def create_app_jwt(user: AuthedUser) -> str:
    secret = current_app.config["APP_JWT_SECRET"]
    now = int(time.time())
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "iat": now,
        "exp": now + 60 * 60 * 24 * 7,  # 7 days
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def verify_app_jwt(token: str) -> AuthedUser:
    secret = current_app.config["APP_JWT_SECRET"]
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except Exception as e:
        raise AuthError(f"Invalid token: {e}", 401)

    user_id = payload.get("sub")
    email = payload.get("email")
    role = payload.get("role")
    if not user_id or not email or not role:
        raise AuthError("Invalid token payload", 401)
    return AuthedUser(id=user_id, email=email, role=role)


def require_auth() -> AuthedUser:
    if getattr(g, "user", None) is None:
        token = _extract_bearer_token()
        g.user = verify_app_jwt(token)
    return g.user


def require_role(role: str) -> AuthedUser:
    user = require_auth()
    if user.role != role:
        raise AuthError("Forbidden", 403)
    return user

