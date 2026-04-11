import secrets
import string

from datetime import datetime, timezone

from bson import ObjectId
from flask import Blueprint, jsonify, request, current_app
from pymongo.errors import DuplicateKeyError

from ..auth_app import require_auth, require_role
from ..mongo import classrooms_col, enrollments_col, assignments_col, submissions_col, users_col


classrooms_bp = Blueprint("classrooms", __name__)

def _generate_class_code(length: int = 7) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@classrooms_bp.post("/classrooms")
def create_classroom():
    user = require_role("faculty")

    body = request.get_json(silent=True) or {}
    course_name = (body.get("course_name") or "").strip()
    course_code = (body.get("course_code") or "").strip()
    description = (body.get("description") or "").strip() or None
    syllabus_url = (body.get("syllabus_url") or "").strip() or None

    if not course_name or not course_code:
        return jsonify({"error": "course_name and course_code are required"}), 400

    # Try a few times in case class_code collisions happen.
    for _ in range(5):
        class_code = _generate_class_code()
        try:
            doc = {
                "course_name": course_name,
                "course_code": course_code,
                "description": description,
                "syllabus_url": syllabus_url,
                "faculty_id": ObjectId(user.id),
                "class_code": class_code,
                "created_at": datetime.now(timezone.utc),
            }
            result = classrooms_col().insert_one(doc)
            return (
                jsonify(
                    {
                        "id": str(result.inserted_id),
                        "course_name": course_name,
                        "course_code": course_code,
                        "description": description,
                        "syllabus_url": syllabus_url,
                        "faculty_id": user.id,
                        "class_code": class_code,
                        "created_at": doc["created_at"].isoformat(),
                    }
                ),
                201,
            )
        except DuplicateKeyError:
            continue

    return jsonify({"error": "Failed to create classroom"}), 500


@classrooms_bp.get("/classrooms")
def list_classrooms():
    user = require_auth()

    if user.role == "faculty":
        rows = list(classrooms_col().find({"faculty_id": ObjectId(user.id)}).sort("created_at", -1))
    else:
        enr = list(enrollments_col().find({"student_id": ObjectId(user.id)}, {"classroom_id": 1}))
        classroom_ids = [r["classroom_id"] for r in enr]
        if not classroom_ids:
            rows = []
        else:
            rows = list(classrooms_col().find({"_id": {"$in": classroom_ids}}).sort("created_at", -1))

    def ser(c):
        return {
            "id": str(c["_id"]),
            "course_name": c["course_name"],
            "course_code": c["course_code"],
            "description": c.get("description"),
            "syllabus_url": c.get("syllabus_url"),
            "faculty_id": str(c["faculty_id"]),
            "class_code": c["class_code"],
            "created_at": c["created_at"].isoformat() if c.get("created_at") else None,
        }

    return jsonify([ser(r) for r in rows])


@classrooms_bp.post("/classrooms/join")
def join_classroom():
    user = require_role("student")

    body = request.get_json(silent=True) or {}
    class_code = (body.get("class_code") or "").strip().upper()
    if not class_code:
        return jsonify({"error": "class_code is required"}), 400

    classroom = classrooms_col().find_one({"class_code": class_code}, {"_id": 1})
    if not classroom:
        return jsonify({"error": "Invalid class code"}), 404

    try:
        enrollments_col().insert_one(
            {
                "student_id": ObjectId(user.id),
                "classroom_id": classroom["_id"],
                "created_at": datetime.now(timezone.utc),
            }
        )
        return jsonify({"ok": True}), 201
    except DuplicateKeyError:
        return jsonify({"error": "Already joined"}), 400


@classrooms_bp.get("/classrooms/<classroom_id>")
def get_classroom(classroom_id: str):
    user = require_auth()

    c = classrooms_col().find_one({"_id": ObjectId(classroom_id)})
    if not c:
        return jsonify({"error": "Not found"}), 404

    if user.role == "faculty":
        if str(c["faculty_id"]) != user.id:
            return jsonify({"error": "Forbidden"}), 403
    else:
        if not enrollments_col().find_one({"student_id": ObjectId(user.id), "classroom_id": c["_id"]}):
            return jsonify({"error": "Forbidden"}), 403

    return jsonify(
        {
            "id": str(c["_id"]),
            "course_name": c["course_name"],
            "course_code": c["course_code"],
            "description": c.get("description"),
            "syllabus_url": c.get("syllabus_url"),
            "faculty_id": str(c["faculty_id"]),
            "class_code": c["class_code"],
            "created_at": c["created_at"].isoformat() if c.get("created_at") else None,
        }
    )


@classrooms_bp.get("/classrooms/<classroom_id>/leaderboard")
def get_classroom_leaderboard(classroom_id: str):
    user = require_auth()
    c = classrooms_col().find_one({"_id": ObjectId(classroom_id)})
    if not c:
        return jsonify({"error": "Classroom not found"}), 404
        
    return jsonify({"leaderboard": c.get("leaderboard_md")})


@classrooms_bp.post("/classrooms/<classroom_id>/leaderboard/generate")
def generate_classroom_leaderboard(classroom_id: str):
    user = require_auth()
    c = classrooms_col().find_one({"_id": ObjectId(classroom_id)})
    if not c:
        return jsonify({"error": "Classroom not found"}), 404

    if user.role != "faculty" or str(c["faculty_id"]) != user.id:
        return jsonify({"error": "Forbidden"}), 403

    assignments = list(assignments_col().find({"classroom_id": c["_id"]}))
    if not assignments:
        return jsonify({"error": "No assignments available yet"}), 400
        
    assignment_ids = [a["_id"] for a in assignments]
    submissions = list(submissions_col().find({
        "assignment_id": {"$in": assignment_ids},
        "evaluation_feedback": {"$exists": True, "$ne": None}
    }))
    
    if not submissions:
        return jsonify({"error": "No evaluated submissions found to build a leaderboard."}), 400

    student_data = {}
    
    for sub in submissions:
        student_id = str(sub["student_id"])
        
        # Match assignment max marks
        a_id = str(sub["assignment_id"])
        max_marks = next((a.get("max_marks", 100) for a in assignments if str(a["_id"]) == a_id), 100)
        
        if student_id not in student_data:
            student = users_col().find_one({"_id": sub["student_id"]})
            student_data[student_id] = {
                "name": student["name"] if student else "Unknown",
                "feedbacks": [],
                "max_marks_attempted": 0
            }
            
        student_data[student_id]["feedbacks"].append(sub.get("evaluation_feedback", ""))
        student_data[student_id]["max_marks_attempted"] += max_marks

    student_results = []
    for sid, data in student_data.items():
        feedbacks_combined = "\n---\n".join(data["feedbacks"])
        student_results.append(
            f"Student Name: {data['name']}\nCalculated Cumulative Maximum marks: {data['max_marks_attempted']}\nCumulative Feedback:\n{feedbacks_combined}\n======="
        )

    input_data = "\n".join(student_results)
    
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
                {"role": "user", "content": f"Here are the cumulative student results:\n\n{input_data}"}
            ],
            model="llama-3.3-70b-versatile",
        )
        leaderboard_md = response.choices[0].message.content
        
        classrooms_col().update_one(
            {"_id": c["_id"]},
            {"$set": {"leaderboard_md": leaderboard_md}}
        )

        return jsonify({"message": "Leaderboard generated", "leaderboard": leaderboard_md})
    except Exception as e:
        return jsonify({"error": f"Failed to generate cumulative leaderboard: {str(e)}"}), 500

