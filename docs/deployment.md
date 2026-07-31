# Deployment (Render)

The backend deploys to [Render](https://render.com) as a Docker web service,
defined by `render.yaml` at the repo root (a Render "Blueprint").

## One-time setup

1. Sign up / log in at [render.com](https://render.com) (GitHub sign-in is
   easiest — it also makes connecting the repo a one-click step).
2. Two ways to create the service — either works, pick whichever's in front
   of you:
   - **Blueprint** (recommended, less manual entry): **New +** → **Blueprint**
     → select the `JobFitAI` GitHub repo. Render reads `render.yaml`
     automatically and pre-fills everything (Docker runtime, health check
     path, prompts for the two env vars below).
   - **Manual Web Service**: **New +** → **Web Service** → select the repo
     → change **Language** from the default "Python 3" to **Docker** (this
     makes Render use `Dockerfile` directly instead of asking for a build
     command) → leave **Root Directory** blank (the Dockerfile needs repo
     root as build context, since it copies both `backend/` and `prompts/`)
     → under **Advanced**, set **Health Check Path** to `/health`.
3. Add two environment variables (in the Blueprint flow these are prompted
   for automatically as `sync: false` values from `render.yaml`, meaning
   Render never reads them from that file — you always type the real
   values directly into Render's dashboard, so they never touch git or the
   built image):
   - `GEMINI_API_KEY` — your Gemini API key
   - `API_KEY` — the same shared secret the Chrome extension sends as
     `X-API-Key` (see [Issue 5.1](../README.md)); generate one with
     `python -c "import secrets; print(secrets.token_urlsafe(32))"`
4. Click **Deploy**. Render builds the image and deploys — this takes a
   few minutes the first time.
5. Once live, Render gives you a public URL like
   `https://jobfitai-api.onrender.com`. Confirm it works:
   ```
   curl https://jobfitai-api.onrender.com/health
   ```
   should return `{"status":"ok"}` over HTTPS.

Render assigns a dynamic `PORT` env var and routes traffic to it — the
Dockerfile's `CMD` reads `$PORT` (falling back to 8000 for local
`docker compose up`, where it's unset), so this works with either flow
above without any extra configuration.

## Auto-deploy on merge to main

Render's Blueprint services have **Auto-Deploy** enabled by default — every
push to `main` triggers a new build and deploy automatically, with no extra
CI step needed. Check this under the service's **Settings** tab if you want
to confirm or change it.

## Free tier notes

- **Cold starts**: Render's free plan spins the service down after ~15
  minutes of no traffic. The next request after that wakes it back up, but
  takes 30-60 seconds before it responds — the Chrome extension (see
  [Issue 6.4](../README.md)) should be expected to feel slow on a cold
  start, not broken.
- **No persistent disk**: free instances don't support persistent disks, so
  the SQLite file (`backend/data/jobfitai.db`) lives only on the
  container's ephemeral filesystem — it's wiped on every restart, spin-down,
  or redeploy. In practice this means your stored profile (`POST /profile`)
  needs to be re-sent after the free instance restarts. This is a real
  limitation, not a bug: fixing it would mean either upgrading to a paid
  instance (Starter, $7/mo, supports persistent disks) or switching to a
  managed database (e.g. Render's free PostgreSQL) instead of SQLite —
  both bigger changes than this issue's scope, worth doing later if the
  deployed instance becomes more than a demo.

## Pointing the extension at the deployed backend

Once you have the Render URL, open the extension popup's settings and set
the **Backend URL** field to it (instead of the `http://localhost:8000`
default) — see `extension/popup/popup.js`. No code change or rebuild of the
extension is required; it's stored per-browser via `chrome.storage.local`.
