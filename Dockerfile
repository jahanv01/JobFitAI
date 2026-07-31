# Build context is the repo root (not backend/) because backend/main.py
# reads prompt templates from ../prompts relative to its own location —
# the image preserves that same backend/ + prompts/ sibling layout.

FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY prompts/ prompts/

WORKDIR /app/backend

EXPOSE 8000

# Shell form (not exec-array form) so ${PORT:-8000} actually gets expanded —
# hosting platforms like Render assign a dynamic PORT env var and route
# traffic to it, so the app must listen on that when present. Falls back to
# 8000 for local `docker compose up`, where PORT isn't set.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
