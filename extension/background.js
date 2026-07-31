// Manifest V3 service worker. Chrome can terminate this at any time between
// events, so nothing here is held in memory across messages — anything that
// needs to persist (the scraped job description per tab) is written to
// chrome.storage.local instead.
//
// Message flow (issue 4.2b):
//   content-script.js  --JOB_SCRAPED-->  background.js  --stores in-->  chrome.storage.local
//   popup.js  --GET_SCRAPED_JOB-->  background.js  --reads/relays-->  popup.js

const STORAGE_PREFIX = "jobfitai_scrape_";

function storageKeyForTab(tabId) {
  return `${STORAGE_PREFIX}${tabId}`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "JOB_SCRAPED") {
    const tabId = sender.tab?.id;
    if (tabId == null) return false;
    chrome.storage.local.set({
      [storageKeyForTab(tabId)]: {
        jobDescription: message.jobDescription,
        jobUrl: message.jobUrl,
      },
    });
    return false;
  }

  if (message?.type === "GET_SCRAPED_JOB") {
    const { tabId } = message;
    const key = storageKeyForTab(tabId);

    chrome.storage.local.get(key, async (result) => {
      const cached = result[key];
      if (cached?.jobDescription) {
        sendResponse(cached);
        return;
      }

      // Nothing cached yet — e.g. the popup was opened before the content
      // script's MutationObserver found the job description element. Ask
      // the content script directly for an immediate re-read; if there's no
      // content script in this tab at all (not a LinkedIn job page), this
      // throws and we fall back to null so the popup uses the paste-box.
      try {
        const fresh = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_NOW" });
        if (fresh?.jobDescription) {
          chrome.storage.local.set({ [key]: fresh });
        }
        sendResponse(fresh?.jobDescription ? fresh : null);
      } catch {
        sendResponse(null);
      }
    });
    return true; // keep the message channel open for the async sendResponse above
  }

  return false;
});

// Avoid chrome.storage.local accumulating stale entries for closed tabs.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(storageKeyForTab(tabId));
});
