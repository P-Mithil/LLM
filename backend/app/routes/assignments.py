from datetime import datetime, timezone

from bson import ObjectId
from flask import Blueprint, jsonify, request, current_app

from ..auth_app import require_auth, require_role
from ..mongo import assignments_col, classrooms_col, enrollments_col, submissions_col, users_col


assignments_bp = Blueprint("assignments", __name__)

@assignments_bp.post("/classrooms/<classroom_id>/assignments")
def create_assignment(classroom_id: str):
    user = require_role("faculty")

    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "").strip()
    description = (body.get("description") or "").strip() or None
    deadline = body.get("deadline")  # ISO string expected; stored as timestamptz by PostgREST
    file_url = (body.get("file_url") or "").strip() or None
    evaluation_criteria = (body.get("evaluation_criteria") or "").strip() or None
    model_answer = (body.get("model_answer") or "").strip() or None
    max_marks = body.get("max_marks")
    if max_marks is not None:
        try:
            max_marks = int(max_marks)
        except ValueError:
            return jsonify({"error": "max_marks must be an integer"}), 400

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
        "evaluation_criteria": evaluation_criteria,
        "model_answer": model_answer,
        "max_marks": max_marks,
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
                "evaluation_criteria": evaluation_criteria,
                "model_answer": model_answer,
                "max_marks": max_marks,
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
                "evaluation_criteria": a.get("evaluation_criteria"),
                "model_answer": a.get("model_answer"),
                "max_marks": a.get("max_marks"),
                "created_at": a["created_at"].isoformat() if a.get("created_at") else None,
            }
            for a in rows
        ]
    )

@assignments_bp.get("/assignments/<assignment_id>/leaderboard")
def get_assignment_leaderboard(assignment_id: str):
    user = require_auth()
    try:
        assignment = assignments_col().find_one({"_id": ObjectId(assignment_id)})
    except Exception:
        assignment = None
    if not assignment:
        return jsonify({"error": "Not found"}), 404
        
    return jsonify({"leaderboard": assignment.get("leaderboard_md")})

@assignments_bp.post("/assignments/<assignment_id>/leaderboard/generate")
def generate_assignment_leaderboard(assignment_id: str):
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

    if user.role != "faculty" or str(classroom["faculty_id"]) != user.id:
        return jsonify({"error": "Forbidden"}), 403

    submissions = list(submissions_col().find({
        "assignment_id": assignment["_id"],
        "evaluation_feedback": {"$exists": True, "$ne": None}
    }))
    
    if not submissions:
        return jsonify({"error": "No evaluated submissions found to build a leaderboard."}), 400

    student_results = []
    
    import re
    for sub in submissions:
        student = users_col().find_one({"_id": sub["student_id"]})
        name = student["name"] if student else "Unknown"
        feedback = sub.get("evaluation_feedback", "")
        
        match = re.search(r"Marks:\s*(\d+(?:\.\d+)?)/(\d+(?:\.\d+)?)", feedback, re.IGNORECASE)
        if match:
            obtained = match.group(1)
            total = match.group(2)
            student_results.append(f"* Name: {name}, Marks obtained: {obtained}, Maximum marks: {total}")
        else:
            student_results.append(f"* Name: {name}, Marks: Unknown")

    input_data = "\\n".join(student_results)
    
    system_prompt = """You are generating a leaderboard.

INPUT:
List of students with name and marks.

---

TASK:

* Sort by marks (descending)
* Assign ranks

---

OUTPUT FORMAT (VERY STRICT):

You MUST output ONLY valid JSON.
Do NOT wrap the JSON in markdown code blocks. Do NOT add any extra text.

[
  {"rank": 1, "name": "Rahul", "marks": "14/15", "percentage": "93%"},
  {"rank": 2, "name": "Priya", "marks": "13/15", "percentage": "86%"}
]

---

If you break format, the system will fail."""

    api_key = current_app.config.get("GROQ_API_KEY")
    if not api_key:
        return jsonify({"error": "GROQ_API_KEY is not configured"}), 500
    
    from groq import Groq
    client = Groq(api_key=api_key)
    
    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Here is the list of students:\\n\\n{input_data}"}
            ],
            model="llama-3.3-70b-versatile",
        )
        leaderboard_md = response.choices[0].message.content
        
        assignments_col().update_one(
            {"_id": assignment["_id"]},
            {"$set": {"leaderboard_md": leaderboard_md}}
        )

        return jsonify({"message": "Leaderboard generated", "leaderboard": leaderboard_md})
    except Exception as e:
        return jsonify({"error": f"Failed to generate leaderboard: {str(e)}"}), 500


