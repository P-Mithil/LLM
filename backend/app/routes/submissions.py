from datetime import datetime, timezone

from bson import ObjectId
from flask import Blueprint, jsonify, request, current_app
from ..auth_app import require_auth, require_role
from ..mongo import assignments_col, classrooms_col, enrollments_col, submissions_col, users_col
from ..services.evaluator import evaluate_submission


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

    # ── Deadline enforcement ──────────────────────────────────────────────
    deadline_raw = assignment.get("deadline")
    if deadline_raw:
        try:
            from dateutil import parser as dateutil_parser
            deadline_dt = dateutil_parser.parse(str(deadline_raw))
            if deadline_dt.tzinfo is None:
                import pytz
                deadline_dt = pytz.utc.localize(deadline_dt)
            if datetime.now(timezone.utc) > deadline_dt:
                return jsonify({"error": "Deadline has passed. Submissions are closed."}), 403
        except Exception:
            pass  # If deadline unparseable, allow submission
    # ─────────────────────────────────────────────────────────────────────

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
                "evaluation_feedback": doc.get("evaluation_feedback"),
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
                "evaluation_feedback": s.get("evaluation_feedback"),
                "submitted_at": s["submitted_at"].isoformat() if s.get("submitted_at") else None,
            }
            for s in rows
        ]
    )


@submissions_bp.get("/assignments/<assignment_id>/my-submission")
def get_my_submission(assignment_id: str):
    """Returns the logged-in student's own submission for an assignment."""
    user = require_role("student")
    try:
        assignment = assignments_col().find_one({"_id": ObjectId(assignment_id)})
    except Exception:
        assignment = None
    if not assignment:
        return jsonify({"error": "Not found"}), 404

    doc = submissions_col().find_one(
        {"assignment_id": assignment["_id"], "student_id": ObjectId(user.id)}
    )
    if not doc:
        return jsonify(None), 200

    return jsonify(
        {
            "id": str(doc["_id"]),
            "assignment_id": str(doc["assignment_id"]),
            "student_id": str(doc["student_id"]),
            "file_url": doc["file_url"],
            "evaluation_feedback": doc.get("evaluation_feedback"),
            "submitted_at": doc["submitted_at"].isoformat() if doc.get("submitted_at") else None,
        }
    ), 200

@submissions_bp.post("/assignments/<assignment_id>/submissions/<submission_id>/evaluate")
def evaluate_student_submission(assignment_id: str, submission_id: str):
    user = require_auth()
    try:
        assignment = assignments_col().find_one({"_id": ObjectId(assignment_id)})
    except Exception:
        assignment = None
    if not assignment:
        return jsonify({"error": "Assignment not found"}), 404

    classroom = classrooms_col().find_one({"_id": assignment["classroom_id"]})
    if not classroom:
        return jsonify({"error": "Classroom not found"}), 404

    # Faculty check
    if user.role != "faculty" or str(classroom["faculty_id"]) != user.id:
        return jsonify({"error": "Forbidden"}), 403

    try:
        submission = submissions_col().find_one({"_id": ObjectId(submission_id)})
    except Exception:
        submission = None
    if not submission:
        return jsonify({"error": "Submission not found"}), 404

    if not submission.get("file_url"):
        return jsonify({"error": "No file submitted to evaluate"}), 400

    student = users_col().find_one({"_id": submission["student_id"]})
    student_name = student["name"] if student else "Anonymous"

    try:
        feedback = evaluate_submission(
            question=assignment.get("title", ""),
            description=assignment.get("description", "Provide general evaluation."),
            max_marks=assignment.get("max_marks", 100),
            student_name=student_name,
            student_file_url=submission["file_url"],
            question_file_url=assignment.get("file_url") or "",
        )
    except Exception as e:
        if current_app.config.get("DEBUG"):
            return jsonify({"error": f"Evaluation failed: {str(e)}"}), 500
        return jsonify({"error": "Evaluation failed"}), 500

    # Save to MongoDB
    submissions_col().update_one(
        {"_id": submission["_id"]},
        {"$set": {"evaluation_feedback": feedback}}
    )

    return jsonify({"message": "Evaluation successful", "feedback": feedback})

