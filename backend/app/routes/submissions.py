from datetime import datetime, timezone

from bson import ObjectId
from flask import Blueprint, jsonify, request
from ..auth_app import require_auth, require_role
from ..mongo import assignments_col, classrooms_col, enrollments_col, submissions_col


submissions_bp = Blueprint("submissions", __name__)

@submissions_bp.post("/assignments/<assignment_id>/submissions")
def submit_assignment(assignment_id: str):
    user = require_role("student")

    body = request.get_json(silent=True) or {}
    file_url = (body.get("file_url") or "").strip()
    if not file_url:
        return jsonify({"error": "file_url is required"}), 400

    try:
        assignment = assignments_col().find_one({"_id": ObjectId(assignment_id)})
    except Exception:
        assignment = None
    if not assignment:
        return jsonify({"error": "Not found"}), 404

    classroom = classrooms_col().find_one({"_id": assignment["classroom_id"]})
    if not classroom:
        return jsonify({"error": "Not found"}), 404

    if not enrollments_col().find_one({"student_id": ObjectId(user.id), "classroom_id": classroom["_id"]}):
        return jsonify({"error": "Forbidden"}), 403

    now = datetime.now(timezone.utc)
    submissions_col().update_one(
        {"assignment_id": assignment["_id"], "student_id": ObjectId(user.id)},
        {"$set": {"file_url": file_url, "submitted_at": now}},
        upsert=True,
    )
    doc = submissions_col().find_one({"assignment_id": assignment["_id"], "student_id": ObjectId(user.id)})
    return (
        jsonify(
            {
                "id": str(doc["_id"]),
                "assignment_id": str(doc["assignment_id"]),
                "student_id": str(doc["student_id"]),
                "file_url": doc["file_url"],
                "submitted_at": doc["submitted_at"].isoformat() if doc.get("submitted_at") else None,
            }
        ),
        201,
    )


@submissions_bp.get("/assignments/<assignment_id>/submissions")
def list_submissions(assignment_id: str):
    user = require_auth()
    try:
        assignment = assignments_col().find_one({"_id": ObjectId(assignment_id)})
    except Exception:
        assignment = None
    if not assignment:
        return jsonify({"error": "Not found"}), 404

    classroom = classrooms_col().find_one({"_id": assignment["classroom_id"]})
    if not classroom:
        return jsonify({"error": "Not found"}), 404

    if user.role != "faculty" or str(classroom["faculty_id"]) != user.id:
        return jsonify({"error": "Forbidden"}), 403

    rows = list(submissions_col().find({"assignment_id": assignment["_id"]}).sort("submitted_at", -1))
    return jsonify(
        [
            {
                "id": str(s["_id"]),
                "assignment_id": str(s["assignment_id"]),
                "student_id": str(s["student_id"]),
                "file_url": s["file_url"],
                "submitted_at": s["submitted_at"].isoformat() if s.get("submitted_at") else None,
            }
            for s in rows
        ]
    )

