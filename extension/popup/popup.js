// Popup script. Talks to the content script/background worker to auto-fill
// a scraped LinkedIn job description (falling back to manual paste), and
// calls the local backend directly for /analyze and /cover-letter — popup
// pages are exempt from CORS for origins listed in manifest.json's
// host_permissions, so no relay through the background worker is needed here.

const BASE_URL = "http://localhost:8000";

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

// Set once we know the URL of the tab the JD came from (LinkedIn flow only);
// stays null for the manual paste-box flow.
let jobUrl = null;

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

// Fills the paste-box automatically if the content script (relayed through
// the background worker) found a job description on the active tab; if not
// (non-LinkedIn tab, page not loaded yet, LinkedIn changed their markup),
// this just leaves the box empty for manual paste — issue 4.2a's flow.
async function loadScrapedJobDescription() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusEl.textContent = "Paste a job description below.";
    return;
  }

  chrome.runtime.sendMessage({ type: "GET_SCRAPED_JOB", tabId: tab.id }, (cached) => {
    if (chrome.runtime.lastError || !cached?.jobDescription) {
      statusEl.textContent = "Paste a job description below.";
      return;
    }
    jobDescriptionEl.value = cached.jobDescription;
    jobUrl = cached.jobUrl || tab.url || null;
    statusEl.textContent = "Auto-filled from the open LinkedIn job posting.";
  });
}

// Shared POST helper: turns network failures and non-2xx responses into a
// single Error so callers don't each need their own fetch error handling.
async function postJson(path, body) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the JobFitAI backend. Is it running on localhost:8000?");
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
  const jobDescription = jobDescriptionEl.value.trim();
  if (!jobDescription) {
    showError("Paste or auto-fill a job description first.");
    return;
  }

  setBusy(analyzeBtn, "Analyzing…");
  resultsEl.hidden = true;

  try {
    const data = await postJson("/analyze", { job_description: jobDescription, job_url: jobUrl });
    renderResults(data);
  } catch (err) {
    showError(err.message);
  } finally {
    clearBusy(analyzeBtn);
  }
}

async function generateCoverLetter() {
  clearError();
  const jobDescription = jobDescriptionEl.value.trim();
  if (!jobDescription) {
    showError("Paste or auto-fill a job description first.");
    return;
  }

  setBusy(coverLetterBtn, "Writing…");
  coverLetterSectionEl.hidden = true;
  copyStatusEl.textContent = "";

  try {
    const data = await postJson("/cover-letter", { job_description: jobDescription });
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

loadScrapedJobDescription();
