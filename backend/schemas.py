# Pydantic models used for FastAPI request validation and response shaping.
# These mirror models.py but are separate on purpose: models.py defines
# what's stored in the DB, these define what the API accepts/returns.

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class ProfileIn(BaseModel):
    """Request body for POST /profile."""

    name: str
    raw_text: Optional[str] = None
    structured_json: Optional[dict[str, Any]] = None


class ProfileOut(BaseModel):
    """Response body for POST/GET /profile. from_attributes=True lets this
    be built directly from a SQLAlchemy Profile ORM object."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    raw_text: Optional[str] = None
    structured_json: Optional[dict[str, Any]] = None
    updated_at: Optional[datetime] = None


class AnalyzeRequest(BaseModel):
    """Request body for POST /analyze — just the raw job posting text."""

    job_description: str


class MatchResultOut(BaseModel):
    """Response body for POST /analyze, built directly from a saved
    MatchResult row. raw_response holds the full structured breakdown
    (category scores, strengths, gaps, apply_recommendation)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    job_title: Optional[str] = None
    company: Optional[str] = None
    match_pct: Optional[int] = None
    raw_response: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
