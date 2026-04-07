from datetime import datetime, timezone

from bson import ObjectId
from flask import Blueprint, jsonify, request

from ..auth_app import require_auth, require_role
from ..mongo import assignments_col, classrooms_col, enrollments_col


assignments_bp = Blueprint("assignments", __name__)

@assignments_bp.post("/classrooms/<classroom_id>/assignments")
def create_assignment(classroom_id: str):
    user = require_role("faculty")

    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "").strip()
    description = (body.get("description") or "").strip() or None
    deadline = body.get("deadline")  # ISO string expected; stored as timestamptz by PostgREST
    file_url = (body.get("file_url") or "").strip() or None

    if not title:
        return jsonify({"error": "title is required"}), 400

    try:
        classroom = classrooms_col().find_one({"_id": ObjectId(classroom_id)})
    except Exception:
        classroom = None
    if not classroom or str(classroom["faculty_id"]) != user.id:
        return jsonify({"error": "Forbidden"}), 403

    doc = {
        "classroom_id": classroom["_id"],
        "title": title,
        "description": description,
        "deadline": deadline,
        "file_url": file_url,
        "created_at": datetime.now(timezone.utc),
    }
    result = assignments_col().insert_one(doc)
    return (
        jsonify(
            {
                "id": str(result.inserted_id),
                "classroom_id": str(classroom["_id"]),
                "title": title,
                "description": description,
                "deadline": deadline,
                "file_url": file_url,
                "created_at": doc["created_at"].isoformat(),
            }
        ),
        201,
    )


@assignments_bp.get("/classrooms/<classroom_id>/assignments")
def list_assignments(classroom_id: str):
    user = require_auth()
    # Membership/ownership check
    try:
        classroom = classrooms_col().find_one({"_id": ObjectId(classroom_id)})
    except Exception:
        classroom = None
    if not classroom:
        return jsonify({"error": "Not found"}), 404

    allowed = False
    if user.role == "faculty" and str(classroom["faculty_id"]) == user.id:
        allowed = True
    if user.role == "student" and enrollments_col().find_one({"student_id": ObjectId(user.id), "classroom_id": classroom["_id"]}):
        allowed = True
    if not allowed:
        return jsonify({"error": "Forbidden"}), 403

    rows = list(assignments_col().find({"classroom_id": classroom["_id"]}).sort("created_at", -1))
    return jsonify(
        [
            {
                "id": str(a["_id"]),
                "classroom_id": str(a["classroom_id"]),
                "title": a["title"],
                "description": a.get("description"),
                "deadline": a.get("deadline"),
                "file_url": a.get("file_url"),
                "created_at": a["created_at"].isoformat() if a.get("created_at") else None,
            }
            for a in rows
        ]
    )

