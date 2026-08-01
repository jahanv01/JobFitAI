// Popup script. On Analyze/Generate Cover Letter, if the job description
// box is empty, injects content-script.js into the active tab on demand
// (chrome.scripting.executeScript, via the activeTab permission) to scrape
// whatever job posting is currently on screen — LinkedIn or otherwise —
// falling back to manual paste if nothing job-related is found there.
// Deliberately does NOT scrape on popup open: the generic (non-LinkedIn)
// extraction heuristic is less reliable than LinkedIn's specific one, so
// scraping is tied to an explicit action instead of firing silently
// every time the popup happens to be opened.
//
// Also calls the backend directly for /analyze and /cover-letter — popup
// pages are exempt from CORS for origins listed in manifest.json's
// host_permissions.

const DEFAULT_BASE_URL = "http://localhost:8000";
const BASE_URL_STORAGE_KEY = "jobfitai_base_url";
const API_KEY_STORAGE_KEY = "jobfitai_api_key";

const apiKeySection = document.getElementById("apiKeySection");
const backendUrlInput = document.getElementById("backendUrlInput");
const apiKeyInput = document.getElementById("apiKeyInput");
const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
const apiKeyStatusEl = document.getElementById("apiKeyStatus");
const jobDescriptionEl = document.getElementById("jobDescription");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const analyzeBtn = document.getElementById("analyzeBtn");
const coverLetterBtn = document.getElementById("coverLetterBtn");
const resultsEl = document.getElementById("results");
const matchPctEl = document.getElementById("matchPct");
const tierBadgeEl = document.getElementById("tierBadge");
const categoryBreakdownEl = document.getElementById("categoryBreakdown");
const coverLetterSectionEl = document.getElementById("coverLetterSection");
const coverLetterTextEl = document.getElementById("coverLetterText");
const copyBtn = document.getElementById("copyBtn");
const copyStatusEl = document.getElementById("copyStatus");

const CATEGORY_LABELS = {
  education: "Education",
  programming: "Programming",
  ai_ml: "AI/ML",
  experience: "Experience",
};

// Set once a scrape succeeds, to whatever tab it came from; stays null for
// the manual paste-box flow.
let jobUrl = null;

// The backend token (see backend's require_api_key) and the backend's base
// URL (issue 6.4 — a config flag rather than a hardcoded string, so this
// same extension build works against localhost during development and a
// deployed Render URL in production). Both are stored in
// chrome.storage.local so they persist across popup opens/closes — MV3
// popups are torn down every time they lose focus, so nothing kept only
// in a JS variable here would survive.
let apiKey = null;
let baseUrl = DEFAULT_BASE_URL;

async function loadSettings() {
  const stored = await chrome.storage.local.get([API_KEY_STORAGE_KEY, BASE_URL_STORAGE_KEY]);
  apiKey = stored[API_KEY_STORAGE_KEY] || null;
  baseUrl = stored[BASE_URL_STORAGE_KEY] || DEFAULT_BASE_URL;

  backendUrlInput.value = baseUrl;
  if (apiKey) {
    apiKeyInput.value = apiKey;
  } else {
    // No key saved yet — expand the section so it's not missed.
    apiKeySection.open = true;
  }
}

async function saveSettings() {
  const urlValue = backendUrlInput.value.trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
  const keyValue = apiKeyInput.value.trim();
  if (!keyValue) {
    apiKeyStatusEl.textContent = "Enter an API key first.";
    return;
  }
  await chrome.storage.local.set({
    [BASE_URL_STORAGE_KEY]: urlValue,
    [API_KEY_STORAGE_KEY]: keyValue,
  });
  baseUrl = urlValue;
  apiKey = keyValue;
  backendUrlInput.value = urlValue;
  apiKeyStatusEl.textContent = "Saved.";
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

function setBusy(button, busyLabel) {
  button.dataset.originalLabel = button.dataset.originalLabel || button.textContent;
  button.disabled = true;
  button.textContent = busyLabel;
}

function clearBusy(button) {
  button.disabled = false;
  if (button.dataset.originalLabel) button.textContent = button.dataset.originalLabel;
}

// If the job description box already has text (manual paste, or a scrape
// from earlier in this same popup session), this never overwrites it —
// only attempts a scrape when the box is empty. Returns true once the box
// has content one way or another, false if nothing was found (caller shows
// the "paste a job description" error in that case).
async function ensureJobDescription() {
  if (jobDescriptionEl.value.trim()) return true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return false;

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-script.js"],
    });
    if (result?.jobDescription) {
      jobDescriptionEl.value = result.jobDescription;
      jobUrl = result.jobUrl || tab.url || null;
      statusEl.textContent = "Scanned from the current page.";
      return true;
    }
  } catch {
    // Injection can fail on pages Chrome restricts extensions from
    // touching (chrome:// URLs, the Web Store, etc.) — treat the same as
    // "nothing found" rather than surfacing a raw error.
  }
  return false;
}

// Shared POST helper: turns network failures and non-2xx responses into a
// single Error so callers don't each need their own fetch error handling.
async function postJson(path, body) {
  if (!apiKey) {
    throw new Error("Set your backend API key above first.");
  }

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Could not reach the JobFitAI backend at ${baseUrl}. Is it running?`);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON body — fall through with data = null below.
  }

  if (!response.ok) {
    throw new Error(data?.detail || `Request failed (${response.status})`);
  }
  return data;
}

function renderResults(data) {
  const breakdown = data.raw_response?.category_breakdown || {};
  const tier = data.raw_response?.apply_recommendation?.tier;

  matchPctEl.textContent = `${data.match_pct ?? "?"}% match`;
  tierBadgeEl.textContent = tier ? tier.replaceAll("_", " ") : "";

  categoryBreakdownEl.innerHTML = "";
  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
    const entry = breakdown[key];
    const li = document.createElement("li");
    li.textContent = `${label}: ${entry?.score ?? "?"}%`;
    categoryBreakdownEl.appendChild(li);
  }

  resultsEl.hidden = false;
}

async function analyze() {
  clearError();

  setBusy(analyzeBtn, "Scanning page…");
  const found = await ensureJobDescription();
  if (!found) {
    clearBusy(analyzeBtn);
    showError("Paste or auto-fill a job description first.");
    return;
  }

  setBusy(analyzeBtn, "Analyzing…");
  resultsEl.hidden = true;

  try {
    const data = await postJson("/analyze", {
      job_description: jobDescriptionEl.value.trim(),
      job_url: jobUrl,
    });
    renderResults(data);
  } catch (err) {
    showError(err.message);
  } finally {
    clearBusy(analyzeBtn);
  }
}

async function generateCoverLetter() {
  clearError();

  setBusy(coverLetterBtn, "Scanning page…");
  const found = await ensureJobDescription();
  if (!found) {
    clearBusy(coverLetterBtn);
    showError("Paste or auto-fill a job description first.");
    return;
  }

  setBusy(coverLetterBtn, "Writing…");
  coverLetterSectionEl.hidden = true;
  copyStatusEl.textContent = "";

  try {
    const data = await postJson("/cover-letter", { job_description: jobDescriptionEl.value.trim() });
    coverLetterTextEl.value = data.letter;
    coverLetterSectionEl.hidden = false;
  } catch (err) {
    showError(err.message);
  } finally {
    clearBusy(coverLetterBtn);
  }
}

async function copyCoverLetter() {
  try {
    await navigator.clipboard.writeText(coverLetterTextEl.value);
    copyStatusEl.textContent = "Copied!";
  } catch {
    coverLetterTextEl.select();
    copyStatusEl.textContent = "Press Ctrl+C to copy (clipboard access was blocked).";
  }
}

analyzeBtn.addEventListener("click", analyze);
coverLetterBtn.addEventListener("click", generateCoverLetter);
copyBtn.addEventListener("click", copyCoverLetter);
saveApiKeyBtn.addEventListener("click", saveSettings);

statusEl.textContent =
  "Paste a job description, or click Analyze/Generate Cover Letter on a job posting page to scan it automatically.";
loadSettings();
