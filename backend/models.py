# SQLAlchemy ORM models (i.e. the database tables) for this app.

from sqlalchemy import Column, DateTime, Integer, JSON, String, Text
from sqlalchemy.sql import func

from database import Base


class Profile(Base):
    """The candidate's structured profile — see docs/profile-schema.md for
    what structured_json is expected to contain. This app currently only
    supports a single stored profile (there is no user_id / multi-tenancy);
    POST /profile always updates the one existing row instead of creating
    a new one."""

    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    # Free-text version of the profile (e.g. a pasted CV/notes dump).
    raw_text = Column(Text, nullable=True)
    # Structured version of the profile, matching docs/profile-schema.md.
    # Stored as JSON so the schema can evolve without a DB migration.
    structured_json = Column(JSON, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class MatchResult(Base):
    """One row per successful POST /analyze call — a history of every
    job-match analysis run, so a dashboard can be built on top of this
    later. Only successful analyses are saved; failed LLM calls or
    malformed responses raise an HTTP error instead of writing a row."""

    __tablename__ = "match_results"

    id = Column(Integer, primary_key=True, index=True)
    # job_title/company are extracted by the LLM from the job description
    # text itself (see prompts/match_analysis.txt) — best-effort, may be
    # null if the posting didn't clearly state them.
    job_title = Column(String, nullable=True)
    company = Column(String, nullable=True)
    match_pct = Column(Integer, nullable=True)
    # Full parsed JSON response from the LLM (category breakdown,
    # strengths, gaps, apply_recommendation, etc.) — kept in full so
    # nothing has to be recomputed to show a detailed view later.
    raw_response = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
