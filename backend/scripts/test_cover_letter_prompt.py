"""Manual test for prompts/cover_letter.txt against a real job posting.

Standalone script (not part of the FastAPI app) for quickly checking the
cover letter prompt end-to-end against Gemini.

Usage (run from backend/, with GEMINI_API_KEY set in backend/.env):
    python scripts/test_cover_letter_prompt.py path/to/job_description.txt [--tone "..."]

Uses the profile currently stored via POST /profile (see issue 1.2). Run
that endpoint first if you haven't stored a profile yet. match_analysis is
left empty here — the template is written to work without it too.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config  # noqa: F401  (validates GEMINI_API_KEY is set)
from database import SessionLocal
from google import genai
from models import Profile

PROMPT_PATH = Path(__file__).resolve().parent.parent.parent / "prompts" / "cover_letter.txt"


def load_profile_text() -> str:
    db = SessionLocal()
    try:
        profile = db.query(Profile).first()
    finally:
        db.close()

    if not profile:
        raise SystemExit("No profile stored yet. POST your profile to /profile first.")

    if profile.structured_json:
        return json.dumps(profile.structured_json, indent=2)
    if profile.raw_text:
        return profile.raw_text
    raise SystemExit("Stored profile has neither structured_json nor raw_text set.")


def main():
    args = sys.argv[1:]
    if not args:
        raise SystemExit(
            'Usage: python scripts/test_cover_letter_prompt.py <job_description.txt> [--tone "..."]'
        )

    job_path = args[0]
    tone = ""
    if "--tone" in args:
        tone = args[args.index("--tone") + 1]

    job_description = Path(job_path).read_text(encoding="utf-8")
    profile_text = load_profile_text()

    template = PROMPT_PATH.read_text(encoding="utf-8")
    prompt = (
        template.replace("{profile}", profile_text)
        .replace("{job_description}", job_description)
        .replace("{match_analysis}", "")
        .replace("{tone}", tone)
    )

    client = genai.Client(api_key=config.GEMINI_API_KEY)
    response = client.models.generate_content(
        model="gemini-flash-latest",
        contents=prompt,
    )

    print(response.text)


if __name__ == "__main__":
    main()
