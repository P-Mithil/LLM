from __future__ import annotations

from flask import Blueprint, jsonify, request, current_app
from bson import ObjectId
from groq import Groq

from ..auth_app import require_auth, require_role
from ..mongo import classrooms_col, enrollments_col
from ..services.groq_ai import chat_json
from ..services.rag import rebuild_index, retrieve, upsert_material
from ..services.evaluator import extract_text_from_url


ai_bp = Blueprint("ai", __name__)


def _get_classroom_and_check_access(classroom_id: str, user):
    try:
        c = classrooms_col().find_one({"_id": ObjectId(classroom_id)})
    except Exception:
        c = None
    if not c:
        return None, (jsonify({"error": "Not found"}), 404)

    allowed = False
    if user.role == "faculty" and str(c["faculty_id"]) == user.id:
        allowed = True
    if user.role == "student" and enrollments_col().find_one({"student_id": ObjectId(user.id), "classroom_id": c["_id"]}):
        allowed = True
    if not allowed:
        return None, (jsonify({"error": "Forbidden"}), 403)

    return c, None


@ai_bp.post("/ai/assignment-help")
def assignment_help():
    user = require_role("student")
    body = request.get_json(silent=True) or {}
    question = (body.get("question") or "").strip()
    attempt = (body.get("attempt") or "").strip()
    want_final = bool(body.get("want_final") or False)

    if not question:
        return jsonify({"error": "question is required"}), 400

    system = (
        "You are a helpful tutor. Explain in simple language. "
        "Encourage learning and give step-by-step hints. "
        "Do not provide the final answer unless explicitly allowed."
    )

    user_msg = (
        f"Assignment question:\n{question}\n\n"
        + (f"Student attempt:\n{attempt}\n\n" if attempt else "")
        + f"Final answer allowed: {want_final}\n"
        "Return: a short explanation, then 3-7 hints, then tips. "
        "If final answer is not allowed, DO NOT give the final answer."
    )

    schema = """{
  "answer": "string (explanation; include final answer ONLY if allowed)",
  "steps": ["string (hint 1)", "string (hint 2)"],
  "tips": ["string"]
}"""

    try:
        result = chat_json(system=system, user=user_msg, schema_hint=schema, temperature=0.3)
        data = result.data
        return jsonify(
            {
                "answer": str(data.get("answer") or ""),
                "steps": list(data.get("steps") or []),
                "tips": list(data.get("tips") or []),
            }
        )
    except Exception as e:
        if current_app.config.get("DEBUG"):
            return jsonify({"error": "AI request failed", "details": str(e)}), 502
        return jsonify({"error": "AI request failed"}), 502


@ai_bp.post("/ai/chat")
def ai_chat():
    user = require_auth()
    body = request.get_json(silent=True) or {}
    classroom_id = (body.get("classroom_id") or "").strip()
    question = (body.get("question") or "").strip()
    if not classroom_id or not question:
        return jsonify({"error": "classroom_id and question are required"}), 400

    _, err = _get_classroom_and_check_access(classroom_id, user)
    if err:
        return err

    chunks = retrieve(classroom_id=classroom_id, query=question, k=5)
    context = "\n\n".join(
        [f"[{c.get('kind')}] {c.get('title')}\nSource: {c.get('source_url')}\n{c.get('text')}" for c in chunks]
    )

    system = (
        "You are a classroom doubt-solver. You MUST use only the provided context. "
        "If the answer is not present in the context, say you don't know based on the materials and suggest what to check."
    )
    user_msg = (
        f"Context (class materials):\n{context if context else '(no indexed materials)'}\n\n"
        f"Student question:\n{question}\n\n"
        "Answer clearly. If no context is available, say materials are not indexed yet and give general guidance."
    )

    schema = """{
  "answer": "string",
  "steps": ["string"],
  "tips": ["string"],
  "sources": [{"chunk_id": "string", "title": "string", "source_url": "string"}]
}"""

    try:
        result = chat_json(system=system, user=user_msg, schema_hint=schema, temperature=0.2)
        data = result.data
        sources = data.get("sources") or []
        if not isinstance(sources, list):
            sources = []
        # If model didn't return sources, fall back to retrieved chunks
        if not sources:
            sources = [
                {"chunk_id": c.get("chunk_id"), "title": c.get("title"), "source_url": c.get("source_url")}
                for c in chunks
            ]
        return jsonify(
            {
                "answer": str(data.get("answer") or ""),
                "steps": list(data.get("steps") or []),
                "tips": list(data.get("tips") or []),
                "sources": sources,
            }
        )
    except Exception as e:
        if current_app.config.get("DEBUG"):
            return jsonify({"error": "AI request failed", "details": str(e)}), 502
        return jsonify({"error": "AI request failed"}), 502


@ai_bp.post("/ai/grade")
def ai_grade():
    user = require_role("faculty")
    body = request.get_json(silent=True) or {}
    question = (body.get("question") or "").strip()
    student_answer = (body.get("student_answer") or "").strip()
    rubric = (body.get("rubric") or "").strip()
    max_marks = body.get("max_marks", 10)
    try:
        max_marks = int(max_marks)
    except Exception:
        return jsonify({"error": "max_marks must be an integer"}), 400

    if not question or not student_answer:
        return jsonify({"error": "question and student_answer are required"}), 400

    system = "You are a strict but fair teacher. Grade objectively. Do not hallucinate facts."
    user_msg = (
        f"Question:\n{question}\n\n"
        f"Rubric (optional):\n{rubric or 'N/A'}\n\n"
        f"Student answer:\n{student_answer}\n\n"
        f"Marks out of {max_marks}. Provide marks + justification + improvements."
    )
    schema = """{
  "answer": "string (feedback + justification)",
  "marks": 0,
  "steps": ["string (improvement step)"],
  "tips": ["string"]
}"""

    try:
        result = chat_json(system=system, user=user_msg, schema_hint=schema, temperature=0.2)
        data = result.data
        marks = data.get("marks")
        try:
            marks_i = int(marks)
        except Exception:
            marks_i = 0
        marks_i = max(0, min(max_marks, marks_i))
        return jsonify(
            {
                "answer": str(data.get("answer") or ""),
                "marks": marks_i,
                "steps": list(data.get("steps") or []),
                "tips": list(data.get("tips") or []),
            }
        )
    except Exception as e:
        if current_app.config.get("DEBUG"):
            return jsonify({"error": "AI request failed", "details": str(e)}), 502
        return jsonify({"error": "AI request failed"}), 502


@ai_bp.post("/ai/summarize")
def ai_summarize():
    user = require_auth()
    body = request.get_json(silent=True) or {}
    text = (body.get("text") or "").strip()
    style = (body.get("style") or "bullets").strip()
    max_bullets = body.get("max_bullets", 10)
    try:
        max_bullets = int(max_bullets)
    except Exception:
        max_bullets = 10

    if not text:
        return jsonify({"error": "text is required"}), 400

    system = "You are a helpful study assistant. Summarize without adding facts."
    user_msg = f"Style: {style}\nMax bullets: {max_bullets}\n\nText:\n{text}"
    schema = """{
  "answer": "string (short summary)",
  "steps": ["string (bullet points)"],
  "tips": ["string (revision tips)"]
}"""

    try:
        result = chat_json(system=system, user=user_msg, schema_hint=schema, temperature=0.2)
        data = result.data
        return jsonify(
            {
                "answer": str(data.get("answer") or ""),
                "steps": list(data.get("steps") or []),
                "tips": list(data.get("tips") or []),
            }
        )
    except Exception as e:
        if current_app.config.get("DEBUG"):
            return jsonify({"error": "AI request failed", "details": str(e)}), 502
        return jsonify({"error": "AI request failed"}), 502


@ai_bp.post("/ai/generate-quiz")
def ai_generate_quiz():
    user = require_role("faculty")
    body = request.get_json(silent=True) or {}
    topic = (body.get("topic") or "").strip()
    num_questions = body.get("num_questions", 5)
    difficulty = (body.get("difficulty") or "medium").strip()
    try:
        num_questions = int(num_questions)
    except Exception:
        num_questions = 5
    num_questions = max(1, min(20, num_questions))

    if not topic:
        return jsonify({"error": "topic is required"}), 400

    system = "You are a quiz generator for a classroom. Do not add obscure trivia unless asked."
    user_msg = f"Topic: {topic}\nDifficulty: {difficulty}\nNumber of questions: {num_questions}\nCreate MCQs with 4 options each."
    schema = """{
  "answer": "string (one-line overview)",
  "questions": [
    {"q":"string","options":["a","b","c","d"],"correct_index":0,"difficulty":"easy|medium|hard"}
  ]
}"""

    try:
        result = chat_json(system=system, user=user_msg, schema_hint=schema, temperature=0.4)
        data = result.data
        questions = data.get("questions") or []
        if not isinstance(questions, list):
            questions = []
        return jsonify({"answer": str(data.get("answer") or ""), "questions": questions})
    except Exception as e:
        if current_app.config.get("DEBUG"):
            return jsonify({"error": "AI request failed", "details": str(e)}), 502
        return jsonify({"error": "AI request failed"}), 502


@ai_bp.post("/ai/study-plan")
def ai_study_plan():
    user = require_role("student")
    body = request.get_json(silent=True) or {}
    weak_areas = body.get("weak_areas") or []
    deadlines = body.get("deadlines") or []
    hours_per_day = body.get("hours_per_day", 2)
    try:
        hours_per_day = int(hours_per_day)
    except Exception:
        hours_per_day = 2

    if not isinstance(weak_areas, list) or not weak_areas:
        return jsonify({"error": "weak_areas must be a non-empty list"}), 400

    system = "You are a study planner. Make a realistic plan with actionable steps."
    user_msg = f"Weak areas: {weak_areas}\nDeadlines: {deadlines}\nHours/day: {hours_per_day}\nCreate a 7-day plan with priorities."
    schema = """{
  "answer": "string (high-level plan)",
  "steps": ["string (day-by-day tasks)"],
  "tips": ["string"]
}"""

    try:
        result = chat_json(system=system, user=user_msg, schema_hint=schema, temperature=0.3)
        data = result.data
        return jsonify(
            {
                "answer": str(data.get("answer") or ""),
                "steps": list(data.get("steps") or []),
                "tips": list(data.get("tips") or []),
            }
        )
    except Exception as e:
        if current_app.config.get("DEBUG"):
            return jsonify({"error": "AI request failed", "details": str(e)}), 502
        return jsonify({"error": "AI request failed"}), 502


@ai_bp.post("/ai/classrooms/<classroom_id>/materials")
def add_material(classroom_id: str):
    user = require_role("faculty")
    _, err = _get_classroom_and_check_access(classroom_id, user)
    if err:
        return err

    body = request.get_json(silent=True) or {}
    kind = (body.get("kind") or "").strip()  # syllabus|notes
    title = (body.get("title") or "").strip()
    source_url = (body.get("source_url") or "").strip()
    if kind not in ("syllabus", "notes"):
        return jsonify({"error": "kind must be syllabus or notes"}), 400
    if not title or not source_url:
        return jsonify({"error": "title and source_url are required"}), 400

    api_key = current_app.config.get("GROQ_API_KEY")
    if not api_key:
        return jsonify({"error": "GROQ_API_KEY is not configured"}), 500
    client = Groq(api_key=api_key)

    try:
        text = extract_text_from_url(source_url, client)
    except Exception as e:
        if current_app.config.get("DEBUG"):
            return jsonify({"error": "Failed to extract text", "details": str(e)}), 400
        return jsonify({"error": "Failed to extract text"}), 400

    if not (text or "").strip():
        return jsonify({"error": "No text could be extracted from the file"}), 400

    mat_id = upsert_material(
        classroom_id=classroom_id,
        kind=kind,
        title=title,
        source_url=source_url,
        extracted_text=text,
    )
    chunks_indexed = rebuild_index(classroom_id)

    return jsonify({"ok": True, "material_id": mat_id, "chunks_indexed": chunks_indexed}), 201

