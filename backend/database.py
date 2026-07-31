# SQLAlchemy setup: the engine/session/Base objects that every model and
# route in this app shares. The SQLite file lives in data/ (relative to this
# file, not the CWD) so it's always in a predictable spot regardless of
# where uvicorn is launched from, and so docker-compose.yml can mount just
# that directory as a volume without touching application code. It's
# gitignored and never committed.

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATA_DIR / 'jobfitai.db'}"

# check_same_thread=False is required for SQLite when it's accessed from
# multiple threads, which FastAPI does by default for sync route handlers.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class that all ORM models (Profile, MatchResult, ...) inherit from.
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it,
    even if the request raises an exception. Use via `Depends(get_db)`."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
