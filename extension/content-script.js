// Injected on https://www.linkedin.com/jobs/* (see manifest.json). Reads the
// already-rendered job description from the DOM of the user's own logged-in
// tab. LinkedIn builds this page client-side, so the description container
// may not exist yet at injection time — wait for it via MutationObserver
// (with a bounded poll as backup) rather than reading on injection instant.
//
// This script never fetches anything itself; it only reads DOM that's
// already rendered in the user's own tab, then hands the text off to the
// background service worker (see background.js) via message passing.

// LinkedIn's current build uses hashed, per-build CSS classes (e.g.
// "cf258440") that are useless as stable selectors — they change on every
// deploy. data-sdui-component and data-testid are deliberate, semantic
// attributes instead of build artifacts, so they're listed first; the
// legacy class-based selectors are kept as a fallback in case LinkedIn
// serves an older/alternate markup version to some accounts.
const CANDIDATE_SELECTORS = [
  '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"] [data-testid="expandable-text-box"]',
  '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"]',
  '[data-testid="expandable-text-box"]',
  "#job-details",
  ".jobs-description__container",
  ".jobs-description-content__text",
  ".jobs-box__html-content",
  ".jobs-description",
];

const MIN_TEXT_LENGTH = 100; // guards against matching an empty placeholder
const MAX_WAIT_MS = 8000;
const POLL_INTERVAL_MS = 400;

// The "… more" expand/collapse toggle button LinkedIn renders inside the
// description text box is a UI control, not job content — strip any
// buttons out of a clone before reading textContent so its label doesn't
// get appended to the scraped description.
function textWithoutButtons(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll("button").forEach((btn) => btn.remove());
  return clone.textContent.trim();
}

function scrapeNow() {
  for (const selector of CANDIDATE_SELECTORS) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const text = textWithoutButtons(el);
    if (text.length >= MIN_TEXT_LENGTH) {
      return { jobDescription: text, jobUrl: window.location.href };
    }
  }
  return null;
}

function waitForJobDescription(callback) {
  const immediate = scrapeNow();
  if (immediate) {
    callback(immediate);
    return;
  }

  let settled = false;
  const finish = (result) => {
    if (settled) return;
    settled = true;
    observer.disconnect();
    clearInterval(pollId);
    clearTimeout(timeoutId);
    if (result) callback(result);
  };

  const observer = new MutationObserver(() => {
    const result = scrapeNow();
    if (result) finish(result);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Backup poll in case the observed mutations don't cover wherever the
  // description gets inserted, or a callback tick gets missed/throttled.
  const pollId = setInterval(() => {
    const result = scrapeNow();
    if (result) finish(result);
  }, POLL_INTERVAL_MS);

  // Give up after MAX_WAIT_MS — the popup falls back to the paste-box
  // (issue 4.2a) if nothing was ever found for this tab.
  const timeoutId = setTimeout(() => finish(null), MAX_WAIT_MS);
}

waitForJobDescription((result) => {
  chrome.runtime.sendMessage({
    type: "JOB_SCRAPED",
    jobDescription: result.jobDescription,
    jobUrl: result.jobUrl,
  });
});

// Lets the background worker ask for an immediate, synchronous re-read —
// used when the popup opens before the MutationObserver above has found
// anything yet (see background.js's GET_SCRAPED_JOB handling).
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SCRAPE_NOW") {
    sendResponse(scrapeNow());
    return false;
  }
  return false;
});
