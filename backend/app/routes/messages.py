from datetime import datetime, timezone

from bson import ObjectId
from flask import Blueprint, jsonify, request

from ..auth_app import require_auth
from ..mongo import classrooms_col, enrollments_col, messages_col


messages_bp = Blueprint("messages", __name__)

@messages_bp.post("/classrooms/<classroom_id>/messages")
def send_message(classroom_id: str):
    user = require_auth()

    body = request.get_json(silent=True) or {}
    message = (body.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400

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

    now = datetime.now(timezone.utc)
    doc = {
        "classroom_id": classroom["_id"],
        "sender_id": ObjectId(user.id),
        "message": message,
        "timestamp": now,
    }
    res = messages_col().insert_one(doc)
    return (
        jsonify(
            {
                "id": str(res.inserted_id),
                "classroom_id": str(classroom["_id"]),
                "sender_id": user.id,
                "message": message,
                "timestamp": now.isoformat(),
            }
        ),
        201,
    )


@messages_bp.get("/classrooms/<classroom_id>/messages")
def get_messages(classroom_id: str):
    user = require_auth()

    limit = int(request.args.get("limit", "50"))
    before = request.args.get("before")  # ISO timestamp

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

    q = {"classroom_id": classroom["_id"]}
    if before:
        try:
            q["timestamp"] = {"$lt": datetime.fromisoformat(before)}
        except Exception:
            pass

    rows = list(messages_col().find(q).sort("timestamp", -1).limit(limit))
    rows.reverse()
    return jsonify(
        [
            {
                "id": str(m["_id"]),
                "classroom_id": str(m["classroom_id"]),
                "sender_id": str(m["sender_id"]),
                "message": m["message"],
                "timestamp": m["timestamp"].isoformat() if m.get("timestamp") else None,
            }
            for m in rows
        ]
    )

