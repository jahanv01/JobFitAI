"""Manual test for prompts/match_analysis.txt against a real job posting.

This is a standalone script (not part of the FastAPI app) for quickly
checking the prompt template end-to-end against Gemini without going
through the running server / POST /analyze endpoint.

Usage (run from backend/, with GEMINI_API_KEY set in backend/.env):
    python scripts/test_match_prompt.py path/to/job_description.txt

Uses the profile currently stored via POST /profile (see issue 1.2). Run
that endpoint first if you haven't stored a profile yet.
"""

import json
import sys
from pathlib import Path

# Allows `import config`, `from database import ...`, etc. below to resolve,
# since this script lives in backend/scripts/ rather than backend/ itself.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config  # noqa: F401  (validates GEMINI_API_KEY is set)
from database import SessionLocal
from google import genai
from models import Profile

# prompts/ lives at the repo root, two levels up from this script.
PROMPT_PATH = Path(__file__).resolve().parent.parent.parent / "prompts" / "match_analysis.txt"


def load_profile_text() -> str:
    """Fetch the stored profile from the local SQLite DB and return it as
    text ready to drop into the prompt template (structured JSON if we
    have it, otherwise raw text)."""
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
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/test_match_prompt.py <job_description.txt>")

    job_description = Path(sys.argv[1]).read_text(encoding="utf-8")
    profile_text = load_profile_text()

    template = PROMPT_PATH.read_text(encoding="utf-8")
    prompt = template.replace("{profile}", profile_text).replace(
        "{job_description}", job_description
    )

    client = genai.Client(api_key=config.GEMINI_API_KEY)
    response = client.models.generate_content(
        model="gemini-flash-latest",
        contents=prompt,
    )

    # Always print the raw response first so a malformed/non-JSON output
    # can still be inspected manually even if the JSON parse below fails.
    print(response.text)

    try:
        parsed = json.loads(response.text)
    except json.JSONDecodeError:
        print("\n[WARN] Response was not valid JSON as-is.", file=sys.stderr)
        return

    # Quick sanity check of the two fields that matter most at a glance.
    print("\nParsed OK. overall_match_percentage =", parsed.get("overall_match_percentage"))
    print("apply_recommendation =", parsed.get("apply_recommendation", {}).get("tier"))


if __name__ == "__main__":
    main()
