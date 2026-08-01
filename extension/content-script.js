// Injected on demand via chrome.scripting.executeScript (see popup.js's
// ensureJobDescription()) — NOT declared in manifest.json, so this never
// runs passively on every page. It only executes at the exact moment the
// user clicks Analyze/Generate Cover Letter with an empty job description
// box, on whichever tab is active at that moment (activeTab permission).
//
// This script never fetches anything itself; it only reads DOM that's
// already rendered in the user's own tab. The last statement below is a
// bare call to scrapeJobDescription() — chrome.scripting.executeScript
// captures whatever that call's Promise resolves to as its result.

(() => {
  const MIN_TEXT_LENGTH = 100; // LinkedIn — guards against an empty placeholder
  const MIN_GENERIC_TEXT_LENGTH = 200; // higher bar for the generic fallback, more noise risk
  const MAX_WAIT_MS = 8000;
  const POLL_INTERVAL_MS = 400;
  const QUIET_MS = 1500; // give up early if nothing's changed in the DOM for this long

  // Any one of these appearing is a strong enough signal on its own that
  // this is a job posting page.
  const STRONG_SIGNALS = [
    "job description",
    "about the job",
    "about this role",
    "job responsibilities",
    "job requirements",
    "position summary",
  ];

  // These are individually too common elsewhere (e.g. "apply" shows up on
  // newsletter signups) — require a few to co-occur before treating the
  // page as job-related.
  const WEAK_SIGNALS = [
    "qualifications",
    "technical skills",
    "soft skills",
    "requirements",
    "apply now",
    "responsibilities",
    "job posted",
    "years of experience",
  ];
  const WEAK_SIGNAL_THRESHOLD = 2;

  const LINKEDIN_SELECTORS = [
    '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"] [data-testid="expandable-text-box"]',
    '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"]',
    '[data-testid="expandable-text-box"]',
    "#job-details",
    ".jobs-description__container",
    ".jobs-description-content__text",
    ".jobs-box__html-content",
    ".jobs-description",
  ];

  // Common patterns across various job boards/ATS platforms (Greenhouse,
  // Lever, Workday, etc. all use different markup, so this is a grab bag of
  // reasonable guesses, not a guarantee) — tried before falling back to the
  // "largest text block on the page" heuristic.
  const GENERIC_SELECTORS = [
    '[itemprop="description"]', // schema.org JobPosting structured data
    '[class*="job-description" i]',
    '[class*="jobdescription" i]',
    '[id*="job-description" i]',
    '[id*="jobdescription" i]',
    '[class*="description" i]',
    '[role="main"]',
    "main",
    "article",
  ];

  // Strips UI chrome (buttons like LinkedIn's "…more" toggle, nav/script
  // noise) out of a clone before reading textContent, so it doesn't get
  // appended to the scraped description.
  function cleanText(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("button, nav, script, style, noscript").forEach((n) => n.remove());
    return clone.textContent.trim();
  }

  function scrapeLinkedIn() {
    for (const selector of LINKEDIN_SELECTORS) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const text = cleanText(el);
      if (text.length >= MIN_TEXT_LENGTH) return text;
    }
    return null;
  }

  function passesKeywordGate() {
    // textContent rather than innerText: includes non-visible text (e.g.
    // display:none content) that innerText would exclude, but is far more
    // predictable across engines/edge cases and doesn't force a layout
    // reflow — the extraction step below has its own selector/length
    // checks anyway, so a slightly looser gate here isn't a real risk.
    const text = (document.body.textContent || "").toLowerCase();
    if (STRONG_SIGNALS.some((s) => text.includes(s))) return true;
    return WEAK_SIGNALS.filter((s) => text.includes(s)).length >= WEAK_SIGNAL_THRESHOLD;
  }

  // Best-effort guess at the main content block: penalizes elements that
  // are mostly links/buttons (likely nav, footer, or a card list) rather
  // than actual prose.
  function scoreElement(el) {
    const text = el.textContent || "";
    const textLen = text.trim().length;
    if (textLen < MIN_GENERIC_TEXT_LENGTH) return -1;
    const linkCount = el.querySelectorAll("a, button").length;
    const linkDensity = linkCount / Math.max(1, textLen / 100);
    if (linkDensity > 3) return -1;
    return textLen;
  }

  function findLargestTextBlock() {
    const candidates = document.querySelectorAll("div, section, article, main");
    let best = null;
    let bestScore = 0;
    for (const el of candidates) {
      const score = scoreElement(el);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  }

  function scrapeGeneric() {
    if (!passesKeywordGate()) return null;

    for (const selector of GENERIC_SELECTORS) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const text = cleanText(el);
      if (text.length >= MIN_GENERIC_TEXT_LENGTH) return text;
    }

    const largest = findLargestTextBlock();
    if (largest) {
      const text = cleanText(largest);
      if (text.length >= MIN_GENERIC_TEXT_LENGTH) return text;
    }

    return null;
  }

  // Generic wait-and-retry wrapper: some non-LinkedIn job boards are also
  // client-side-rendered, so content may not be there on the first check.
  // Watches via MutationObserver with a bounded poll as backup, same
  // pattern as the LinkedIn-only version this replaced.
  //
  // This now blocks the popup's Analyze/Cover Letter button directly
  // (rather than running passively in the background like the old
  // page-load-triggered version did), so waiting out the full MAX_WAIT_MS
  // on a page that simply isn't job-related — and never will become one,
  // no matter how long we wait — is a real, noticeable stall. QUIET_MS
  // tracks time since the last DOM mutation; if nothing has changed for
  // that long and checkFn still hasn't matched, give up early instead of
  // waiting out the full ceiling. A genuinely-still-loading SPA keeps
  // resetting this timer via its own mutations, so it isn't cut off
  // early — MAX_WAIT_MS remains the hard ceiling for that case.
  function waitFor(checkFn) {
    return new Promise((resolve) => {
      const immediate = checkFn();
      if (immediate) {
        resolve(immediate);
        return;
      }

      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearInterval(pollId);
        clearTimeout(timeoutId);
        clearTimeout(quietTimeoutId);
        resolve(result);
      };

      const resetQuietTimer = () => {
        clearTimeout(quietTimeoutId);
        quietTimeoutId = setTimeout(() => finish(null), QUIET_MS);
      };

      let quietTimeoutId = setTimeout(() => finish(null), QUIET_MS);

      const observer = new MutationObserver(() => {
        const result = checkFn();
        if (result) {
          finish(result);
          return;
        }
        resetQuietTimer();
      });
      observer.observe(document.body, { childList: true, subtree: true });

      const pollId = setInterval(() => {
        const result = checkFn();
        if (result) finish(result);
      }, POLL_INTERVAL_MS);

      const timeoutId = setTimeout(() => finish(null), MAX_WAIT_MS);
    });
  }

  async function scrapeJobDescription() {
    const isLinkedInJobPage = /linkedin\.com\/jobs\//.test(location.href);
    const text = await waitFor(isLinkedInJobPage ? scrapeLinkedIn : scrapeGeneric);
    return text ? { jobDescription: text, jobUrl: location.href } : null;
  }

  return scrapeJobDescription();
})();
