# FastAPI application entrypoint. Run locally with:
#   uvicorn main:app --reload
# Routes:
#   GET  /health   - liveness check
#   POST /profile  - create/update the (single) stored candidate profile
#   GET  /profile  - fetch the stored profile
#   POST /analyze  - score the stored profile against a job description
#                    using the Gemini API, and save the result

import config  # noqa: F401  (validates required env vars are present on startup)

import json
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from google import genai
from pydantic import ValidationError
from sqlalchemy.orm import Session

import models
from database import Base, engine, get_db
from schemas import AnalyzeRequest, MatchAnalysisResponse, MatchResultOut, ProfileIn, ProfileOut

# Creates all tables defined in models.py if they don't already exist.
# There's no migration framework yet — fine at this stage, but any future
# schema change to an existing table will need a manual migration or a
# fresh DB file.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="JobFitAI Backend")

# The prompt template lives outside backend/ so it isn't tied to Python
# specifically and can be reused by other tooling (e.g. the manual test
# script in scripts/) without importing this module.
PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "match_analysis.txt"
GEMINI_MODEL = "gemini-flash-latest"


def _extract_json(text: str) -> dict:
    """Parse LLM output as JSON, tolerating markdown code fences around it.

    Models are asked to return raw JSON only, but in practice sometimes
    wrap it in ```json ... ``` fences anyway — this strips those before
    parsing so callers don't have to deal with it."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
        if text.lower().startswith("json"):
            text = text[4:].strip()
    return json.loads(text)


@app.get("/health")
def health():
    """Basic liveness check — used to confirm the server is up and reachable."""
    return {"status": "ok"}


@app.post("/profile", response_model=ProfileOut)
def upsert_profile(profile: ProfileIn, db: Session = Depends(get_db)):
    """Create the profile if none exists yet, otherwise overwrite the
    existing one. This app intentionally supports only a single profile
    row (single-user, local tool) — there's no concept of multiple
    candidates or profile history here."""
    existing = db.query(models.Profile).first()
    if existing:
        existing.name = profile.name
        existing.raw_text = profile.raw_text
        existing.structured_json = profile.structured_json
    else:
        existing = models.Profile(
            name=profile.name,
            raw_text=profile.raw_text,
            structured_json=profile.structured_json,
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)  # picks up DB-generated fields like updated_at
    return existing


@app.get("/profile", response_model=ProfileOut)
def get_profile(db: Session = Depends(get_db)):
    """Fetch the stored profile, or 404 if POST /profile hasn't been
    called yet."""
    profile = db.query(models.Profile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No profile stored yet.")
    return profile


@app.post("/analyze", response_model=MatchResultOut)
def analyze(request: AnalyzeRequest, db: Session = Depends(get_db)):
    """Score the stored profile against a job description.

    Flow: load the stored profile -> fill the prompt template with the
    profile + job description -> call Gemini -> parse its JSON response ->
    validate that JSON matches the documented match-analysis schema ->
    save it as a MatchResult row -> return it. Any failure along the way
    (missing profile, LLM/network error, a response that isn't valid JSON,
    or valid JSON that doesn't match the expected shape) is turned into a
    clear HTTP error instead of a raw crash, and nothing is saved to the
    DB unless the whole flow succeeds.
    """
    profile = db.query(models.Profile).first()
    if not profile:
        raise HTTPException(status_code=400, detail="No profile stored yet. POST /profile first.")

    # Prefer the structured profile if we have one; fall back to raw text
    # so /analyze still works even before a profile has been structured.
    profile_text = (
        json.dumps(profile.structured_json, indent=2)
        if profile.structured_json
        else (profile.raw_text or "")
    )

    template = PROMPT_PATH.read_text(encoding="utf-8")
    prompt = template.replace("{profile}", profile_text).replace(
        "{job_description}", request.job_description
    )

    client = genai.Client(api_key=config.GEMINI_API_KEY)
    try:
        response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    except Exception as exc:
        # Network errors, rate limits, invalid API key, etc. all land here.
        raise HTTPException(status_code=502, detail=f"LLM call failed: {exc}")

    try:
        parsed = _extract_json(response.text)
    except (json.JSONDecodeError, AttributeError, TypeError):
        # The model didn't return valid JSON (or returned nothing) — this
        # does happen in practice, so it's handled as a clean 502 rather
        # than an unhandled exception.
        raise HTTPException(
            status_code=502,
            detail="LLM returned malformed JSON; could not parse match result.",
        )

    # Being valid JSON isn't enough on its own — confirm it actually has
    # the fields/types promised in prompts/match_analysis.txt (e.g.
    # category_breakdown present with all four categories, apply_recommendation
    # a proper {tier, reasoning} object) before persisting anything.
    try:
        validated = MatchAnalysisResponse.model_validate(parsed)
    except ValidationError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LLM response did not match the expected match-analysis schema: {exc}",
        )

    match_result = models.MatchResult(
        job_title=validated.job_title,
        company=validated.company,
        match_pct=validated.overall_match_percentage,
        raw_response=validated.model_dump(),
    )
    db.add(match_result)
    db.commit()
    db.refresh(match_result)
    return match_result
