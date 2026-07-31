# Central place for loading and validating environment/config values.
# Import this module (e.g. `import config`) early in any entrypoint so the
# app fails fast with a clear error instead of crashing later inside an
# LLM call with a confusing "invalid API key" style error.

import os

from dotenv import load_dotenv

# Reads the .env file (if present) in the current/parent directories and
# populates os.environ. Does nothing if no .env file is found, so this is
# also safe to run in environments where the key is set another way
# (e.g. a real deployment with env vars set by the platform).
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Fail immediately at import time if the key is missing, rather than letting
# every endpoint that needs it fail individually with a less obvious error.
if not GEMINI_API_KEY:
    raise RuntimeError(
        "Missing API key: set GEMINI_API_KEY in a .env file "
        "at the backend/ directory root (see .env.example)."
    )
