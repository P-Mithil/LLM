from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from ..auth_app import AuthedUser, create_app_jwt
from ..mongo import users_col


auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/auth/signup")
def signup():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    role = body.get("role")

    if not name or not email or not password or role not in ("student", "faculty"):
        return jsonify({"error": "name, email, password, role are required"}), 400

    if users_col().find_one({"email": email}, {"_id": 1}):
        return jsonify({"error": "Email already exists"}), 400

    password_hash = generate_password_hash(password)
    doc = {
        "name": name,
        "email": email,
        "role": role,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc),
    }
    result = users_col().insert_one(doc)
    user = AuthedUser(id=str(result.inserted_id), email=email, role=role)
    token = create_app_jwt(user)
    return jsonify({"token": token, "user": {"id": user.id, "name": name, "email": email, "role": role}}), 201


@auth_bp.post("/auth/login")
def login():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    doc = users_col().find_one({"email": email})
    if not doc or not check_password_hash(doc["password_hash"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    user = AuthedUser(id=str(doc["_id"]), email=doc["email"], role=doc["role"])
    token = create_app_jwt(user)
    return jsonify(
        {
            "token": token,
            "user": {
                "id": str(doc["_id"]),
                "name": doc["name"],
                "email": doc["email"],
                "role": doc["role"],
            },
        }
    )

