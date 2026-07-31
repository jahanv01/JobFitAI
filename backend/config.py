import os

from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "Missing API key: set GEMINI_API_KEY in a .env file "
        "at the backend/ directory root (see .env.example)."
    )
