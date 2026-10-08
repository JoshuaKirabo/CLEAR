// Runs in the background — this is the extension's long-lived service worker.
chrome.runtime.onInstalled.addListener(() =>
    {
        console.log("CLEAR installed");
    });

// Clicking the toolbar icon opens or tucks away the sidebar on whatever page you're on.
chrome.action.onClicked.addListener(async (tab) =>
    {
        try
            {
                await chrome.tabs.sendMessage(tab.id, { type: "clear:toggle" });
            }
        catch
            {
                // Not a page we run on by ourselves, so drop the script in now and try again.
                try
                    {
                        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
                        await chrome.tabs.sendMessage(tab.id, { type: "clear:toggle" });
                    }
                catch
                    {
                        // Chrome won't let extensions into its own pages like chrome://, so there's nothing to do there.
                    }
            }
    });

// Handing the sidebar its stylesheet, since pages aren't allowed to load our files directly.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) =>
    {
        if(message.type !== "clear:styles") return;
        fetch(chrome.runtime.getURL("sidebar.css")).then((response) => response.text()).then(sendResponse);

        // Telling Chrome the answer is coming later so it keeps the line open.
        return true;
    });
