import io
import base64
import requests
import pypdf
from flask import current_app
from groq import Groq

# ────────────────────────────────────────────────
# Prompt for evaluation (after text is extracted)
# ────────────────────────────────────────────────
EVAL_PROMPT = """You are an AI evaluator for a classroom assignment.

Your task is to evaluate a student's answer STRICTLY based on the given rubric and question.

INPUT:

* Question: {question}
* Maximum Marks: {max_marks}
* Evaluation Criteria (Rubric): {description}
* Student Answer: {student_answer}

{question_file_section}

---

EVALUATION RULES:

* Evaluate ONLY based on the rubric
* Be strict but fair
* Give partial marks if partially correct
* Do NOT give full marks unless fully correct
* Do NOT hallucinate

---

MARKING STRATEGY:

* Break marks based on rubric
* Assign marks for each criterion
* Total must not exceed max_marks

---

OUTPUT FORMAT (STRICT — NO JSON):

Marks: <marks_obtained>/{max_marks}
Percentage: <percentage>%

Feedback: <clear explanation of performance>

Strengths:

* point 1
* point 2

Weaknesses:

* point 1
* point 2

Rubric Breakdown:

* <criteria 1>: <marks> — <reason>
* <criteria 2>: <marks> — <reason>

---

IMPORTANT:

* Marks must ALWAYS be present
* Format must be exactly as above
* Do NOT output JSON"""

# ────────────────────────────────────────────────
# Prompt for OCR via vision model
# ────────────────────────────────────────────────
OCR_PROMPT = (
    "This is a student's handwritten or scanned assignment submission. "
    "Please carefully read and transcribe ALL the text you can see in this image, "
    "preserving the content faithfully. Do not summarise — output the full text as-is."
)


def _is_image_url(url: str) -> bool:
    """Check if URL points to an image by extension."""
    lower = url.lower().split("?")[0]
    return any(lower.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"))


def _extract_text_from_pdf_bytes(content: bytes) -> str:
    """Try to get selectable text from a PDF."""
    try:
        reader = pypdf.PdfReader(io.BytesIO(content))
        pages_text = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages_text).strip()
    except Exception:
        return ""


def _get_pdf_first_page_as_base64(content: bytes) -> str | None:
    """
    Converts the first page of a PDF to a base64-encoded PNG using pypdf's
    page rendering (only available in pypdf >= 4.x). Falls back to None.
    """
    try:
        from pypdf import PdfReader
        from pypdf._page import PageObject  # noqa: F401

        reader = PdfReader(io.BytesIO(content))
        if not reader.pages:
            return None
        page = reader.pages[0]
        # pypdf 4+ can render a page to a PIL image
        img = page.to_image()  # type: ignore[attr-defined]
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return None


def _url_to_base64(url: str) -> tuple[str, str]:
    """Download URL and return (base64_data, mime_type)."""
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
    b64 = base64.b64encode(resp.content).decode()
    return b64, content_type


def _ocr_with_vision(client: Groq, url: str) -> str:
    """
    Use Groq's vision model to OCR/transcribe an image URL.
    Supports direct image URLs (jpg/png/etc.) and base64 inlined images.
    """
    lower_url = url.lower().split("?")[0]

    # Try sending the URL directly for image files
    if _is_image_url(url):
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": url}},
                    {"type": "text", "text": OCR_PROMPT},
                ],
            }
        ]
    else:
        # PDF or unknown — download and try inline base64
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        content = resp.content

        # 1. Try selectable text first
        text = _extract_text_from_pdf_bytes(content)
        if text:
            return text

        # 2. Try to render first PDF page as image and send inline
        b64 = _get_pdf_first_page_as_base64(content)
        if b64:
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64}"},
                        },
                        {"type": "text", "text": OCR_PROMPT},
                    ],
                }
            ]
        else:
            # Last resort — treat whole PDF bytes as base64 image (will likely fail
            # on non-vision-capable paths, but worth trying)
            b64_raw, mime = _url_to_base64(url)
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{b64_raw}"},
                        },
                        {"type": "text", "text": OCR_PROMPT},
                    ],
                }
            ]

    response = client.chat.completions.create(
        messages=messages,
        model="meta-llama/llama-4-scout-17b-16e-instruct",  # Groq vision model
    )
    return response.choices[0].message.content or ""


def extract_text_from_url(file_url: str, client: Groq) -> str:
    """
    Smart text extraction:
    1. If raw image → OCR via vision model
    2. If PDF with selectable text → extract directly
    3. If PDF with scanned/photo pages → render to image → OCR via vision model
    4. Plain text fallback
    """
    if _is_image_url(file_url):
        return _ocr_with_vision(client, file_url)

    # Download file
    resp = requests.get(file_url, timeout=30)
    resp.raise_for_status()
    content = resp.content

    # Try PDF text
    text = _extract_text_from_pdf_bytes(content)
    if text:
        return text

    # PDF has no selectable text → OCR via vision
    return _ocr_with_vision(client, file_url)


# ────────────────────────────────────────────────
# Public API
# ────────────────────────────────────────────────
def evaluate_submission(
    question: str,
    description: str,
    max_marks: int,
    student_name: str,
    student_file_url: str,
    question_file_url: str = "",
) -> str:
    api_key = current_app.config.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured.")

    client = Groq(api_key=api_key)

    # Step 1 — Extract / OCR the student’s answer
    student_answer = extract_text_from_url(student_file_url, client)
    if not student_answer.strip():
        raise ValueError(
            "Could not extract text from the submitted file. "
            "Please ensure the file is a readable PDF, image, or text document."
        )

    # Step 2 — Extract question paper text if provided
    question_file_section = ""
    if question_file_url:
        try:
            q_text = extract_text_from_url(question_file_url, client)
            if q_text.strip():
                question_file_section = f"Question Paper Content:\n{q_text}"
        except Exception:
            pass  # Non-fatal: proceed without question file

    # Step 3 — Evaluate with Llama
    prompt = EVAL_PROMPT.format(
        question=question or "N/A",
        description=description or "N/A",
        question_file_section=question_file_section,
        student_name=student_name or "Anonymous Student",
        student_answer=student_answer,
        max_marks=max_marks or 100,
    )

    response = client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
    )

    return response.choices[0].message.content
