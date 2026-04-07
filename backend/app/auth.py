from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Optional

import jwt
import requests
from flask import current_app, g, request
from jwt import PyJWKClient


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 401):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class AuthedUser:
    id: str
    email: Optional[str]
    role: Optional[str]
    access_token: str


_jwks_client: Optional[PyJWKClient] = None
_jwks_client_issuer: Optional[str] = None
_jwks_client_last_init: float = 0


def _get_jwks_client(issuer: str) -> PyJWKClient:
    """
    JWKS is cached in-process; if the issuer changes, rebuild.
    """
    global _jwks_client, _jwks_client_issuer, _jwks_client_last_init

    now = time.time()
    if _jwks_client is None or _jwks_client_issuer != issuer or (now - _jwks_client_last_init) > 3600:
        jwks_url = f"{issuer}/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
        _jwks_client_issuer = issuer
        _jwks_client_last_init = now
    return _jwks_client


def _extract_bearer_token() -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise AuthError("Missing Authorization Bearer token", 401)
    return auth_header[len("Bearer ") :].strip()


def verify_supabase_jwt(access_token: str) -> dict[str, Any]:
    issuer = current_app.config["SUPABASE_JWT_ISSUER"].rstrip("/")

    jwks_client = _get_jwks_client(issuer)
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(access_token).key
        payload = jwt.decode(
            access_token,
            signing_key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # Supabase uses aud, but varies by client
            issuer=issuer,
        )
        return payload
    except Exception as e:
        raise AuthError(f"Invalid token: {e}", 401)


def load_authed_user() -> AuthedUser:
    """
    Verify JWT and load user's role from `public.users`.

    We do role lookup via Supabase REST (still using the user's JWT),
    so RLS stays enforced.
    """
    access_token = _extract_bearer_token()
    payload = verify_supabase_jwt(access_token)

    user_id = payload.get("sub")
    if not user_id:
        raise AuthError("Token missing 'sub' claim", 401)

    email = None
    try:
        email = payload.get("email") or payload.get("user_metadata", {}).get("email")
    except Exception:
        email = None

    # Fetch role from DB using PostgREST directly (simple + avoids circular imports)
    sb_url = current_app.config["SUPABASE_URL"].rstrip("/")
    resp = requests.get(
        f"{sb_url}/rest/v1/users",
        headers={
            "apikey": current_app.config["SUPABASE_ANON_KEY"],
            "Authorization": f"Bearer {access_token}",
        },
        params={"select": "id,email,role,name", "id": f"eq.{user_id}"},
        timeout=10,
    )
    if resp.status_code == 200:
        rows = resp.json()
        role = rows[0].get("role") if rows else None
    else:
        role = None

    return AuthedUser(id=user_id, email=email, role=role, access_token=access_token)


def require_auth() -> AuthedUser:
    if getattr(g, "user", None) is None:
        g.user = load_authed_user()
    return g.user


def require_role(role: str) -> AuthedUser:
    user = require_auth()
    if user.role != role:
        raise AuthError("Forbidden", 403)
    return user

