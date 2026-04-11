from datetime import datetime, timezone

from bson import ObjectId
from flask import Blueprint, jsonify, request

from ..auth_app import require_auth
from ..mongo import announcements_col, enrollments_col, classrooms_col, users_col

announcements_bp = Blueprint("announcements", __name__)


def _check_access(user, classroom_id: str):
    """Raise 403 if the user is not the faculty owner or an enrolled student."""
    try:
        oid = ObjectId(classroom_id)
    except Exception:
        return None, (jsonify({"error": "Invalid classroom id"}), 400)

    classroom = classrooms_col().find_one({"_id": oid})
    if not classroom:
        return None, (jsonify({"error": "Classroom not found"}), 404)

    if user.role == "faculty":
        if str(classroom["faculty_id"]) != user.id:
            return None, (jsonify({"error": "Forbidden"}), 403)
    else:
        if not enrollments_col().find_one(
            {"student_id": ObjectId(user.id), "classroom_id": oid}
        ):
            return None, (jsonify({"error": "Forbidden"}), 403)

    return classroom, None


def _ser(ann):
    return {
        "id": str(ann["_id"]),
        "classroom_id": str(ann["classroom_id"]),
        "author_id": str(ann["author_id"]),
        "author_name": ann.get("author_name", "Unknown"),
        "author_role": ann.get("author_role", "faculty"),
        "body": ann.get("body", ""),
        "file_url": ann.get("file_url"),
        "file_name": ann.get("file_name"),
        "created_at": ann["created_at"].isoformat() if ann.get("created_at") else None,
    }


@announcements_bp.get("/classrooms/<classroom_id>/announcements")
def list_announcements(classroom_id: str):
    user = require_auth()
    _, err = _check_access(user, classroom_id)
    if err:
        return err

    rows = list(
        announcements_col()
        .find({"classroom_id": ObjectId(classroom_id)})
        .sort("created_at", -1)
    )
    return jsonify([_ser(r) for r in rows])


@announcements_bp.post("/classrooms/<classroom_id>/announcements")
def post_announcement(classroom_id: str):
    user = require_auth()
    _, err = _check_access(user, classroom_id)
    if err:
        return err

    body = request.get_json(silent=True) or {}
    text = (body.get("body") or "").strip()
    file_url = (body.get("file_url") or "").strip() or None
    file_name = (body.get("file_name") or "").strip() or None

    if not text and not file_url:
        return jsonify({"error": "body or file_url is required"}), 400

    # Resolve author display name from users collection
    user_doc = users_col().find_one({"_id": ObjectId(user.id)}, {"name": 1, "email": 1})
    author_name = (
        (user_doc.get("name") or user_doc.get("email") or "Unknown")
        if user_doc
        else "Unknown"
    )

    doc = {
        "classroom_id": ObjectId(classroom_id),
        "author_id": ObjectId(user.id),
        "author_name": author_name,
        "author_role": user.role,   # "faculty" or "student"
        "body": text,
        "file_url": file_url,
        "file_name": file_name,
        "created_at": datetime.now(timezone.utc),
    }
    result = announcements_col().insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify(_ser(doc)), 201
