# SQLAlchemy setup: the engine/session/Base objects that every model and
# route in this app shares. jobfitai.db is a local SQLite file created next
# to wherever the app is run from; it is gitignored and never committed.

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./jobfitai.db"

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
