# config.py fails fast (raises RuntimeError) if GEMINI_API_KEY/API_KEY are
# missing, and main.py constructs a genai.Client with GEMINI_API_KEY at
# import time. Set dummy values here — before any test module imports
# main/config — so collection doesn't crash in CI, where no real .env
# exists. These are never used to make a real Gemini call: the tests below
# only exercise paths that don't reach the LLM (health check, and an
# auth-rejection path that short-circuits before the route body runs).
import os

os.environ.setdefault("GEMINI_API_KEY", "test-dummy-key")
os.environ.setdefault("API_KEY", "test-dummy-key")
