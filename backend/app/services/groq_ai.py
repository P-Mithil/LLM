from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from flask import current_app
from groq import Groq


@dataclass(frozen=True)
class GroqJsonResult:
    data: dict[str, Any]
    raw_text: str


def _get_client() -> Groq:
    api_key = current_app.config.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured.")
    return Groq(api_key=api_key)


def _extract_json_object(text: str) -> dict[str, Any]:
    """
    Best-effort parser for "JSON-only" model outputs.
    Falls back to extracting the first {...} block if extra text leaks.
    """
    text = (text or "").strip()
    if not text:
        raise ValueError("Empty model response")

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Model did not return JSON")
    candidate = text[start : end + 1]
    parsed = json.loads(candidate)
    if not isinstance(parsed, dict):
        raise ValueError("Parsed JSON is not an object")
    return parsed


def chat_json(*, system: str, user: str, schema_hint: str, temperature: float = 0.2) -> GroqJsonResult:
    """
    Ask Groq LLaMA to return a single JSON object.
    """
    model = current_app.config.get("GROQ_CHAT_MODEL") or "llama-3.3-70b-versatile"
    client = _get_client()

    prompt = (
        f"{system.strip()}\n\n"
        "Return ONLY valid JSON. No markdown, no code fences, no extra text.\n"
        f"JSON schema:\n{schema_hint.strip()}\n\n"
        f"User request:\n{user.strip()}"
    )

    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    text = (resp.choices[0].message.content or "").strip()
    data = _extract_json_object(text)
    return GroqJsonResult(data=data, raw_text=text)

