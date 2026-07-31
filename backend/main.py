import config  # noqa: F401  (validates required env vars are present on startup)

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

import models
from database import Base, engine, get_db
from schemas import ProfileIn, ProfileOut

Base.metadata.create_all(bind=engine)

app = FastAPI(title="JobFitAI Backend")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/profile", response_model=ProfileOut)
def upsert_profile(profile: ProfileIn, db: Session = Depends(get_db)):
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
    db.refresh(existing)
    return existing


@app.get("/profile", response_model=ProfileOut)
def get_profile(db: Session = Depends(get_db)):
    profile = db.query(models.Profile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No profile stored yet.")
    return profile
