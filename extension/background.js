// Runs in the background — this is the extension's long-lived service worker.
chrome.runtime.onInstalled.addListener(() =>
  {
    console.log("CLEAR installed");
  });
