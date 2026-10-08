// Runs inside marketplace pages and slides the CLEAR sidebar in from the right.
const HOST_ID = "clear-sidebar";

let lastUrl = location.href;
let collapsed = false;

// Set once you open it from the toolbar icon, so it sticks around even off a listing.
let forced = false;
let styles = null;

function onMarketplace()
    {
        // Facebook only counts once you're inside Marketplace, not on the feed.
        if(location.hostname.endsWith("facebook.com")) return location.pathname.startsWith("/marketplace");

        // Same deal with Nextdoor, only the For Sale & Free section.
        if(location.hostname.endsWith("nextdoor.com")) return location.pathname.startsWith("/for_sale_and_free");
        return true;
    }

function shouldShow()
    {
        return forced || onMarketplace();
    }

// Grabbing the stylesheet once and reusing it every time the sidebar gets rebuilt.
async function loadStyles()
    {
        if(styles) return styles;
        styles = await chrome.runtime.sendMessage({ type: "clear:styles" });
        return styles;
    }

function fillListing(root)
    {
        // Sites put the item name up front in the tab title, which is good enough until we read the page properly.
        root.querySelector(".listing-title").textContent = document.title || "Untitled listing";
        root.querySelector(".listing-site").textContent = location.hostname.replace(/^www\./, "");
    }

function openSidebar(host)
    {
        collapsed = false;
        host.removeAttribute("data-mounting");
        host.setAttribute("data-open", "");
    }

function collapseSidebar(host)
    {
        collapsed = true;
        host.removeAttribute("data-open");
    }

async function mountSidebar()
    {
        if(document.getElementById(HOST_ID)) return;

        const css = await loadStyles();

        // Something else may have mounted it while we were waiting on the stylesheet.
        if(document.getElementById(HOST_ID) || !shouldShow()) return;

        const host = document.createElement("div");
        host.id = HOST_ID;

        // Keeping the pull tab out of sight on first load, since the sidebar is about to slide in anyway.
        if(!collapsed) host.setAttribute("data-mounting", "");

        const root = host.attachShadow({ mode: "open" });
        root.innerHTML = `
            <style>${css}</style>
            <aside class="sidebar" aria-label="CLEAR">
                <header class="header">
                    <span class="logo">CLEAR</span>
                    <button class="collapse" aria-label="Collapse sidebar">&rsaquo;</button>
                </header>
                <div class="body">
                    <section class="section">
                        <p class="label">Risk score</p>
                        <p class="score">&mdash;</p>
                        <p class="text">Risk check coming soon.</p>
                    </section>
                    <section class="section">
                        <p class="label">Listing</p>
                        <p class="title listing-title"></p>
                        <p class="text listing-site"></p>
                    </section>
                    <section class="section">
                        <p class="label">Signals</p>
                        <p class="text">Nothing flagged yet.</p>
                    </section>
                </div>
            </aside>
            <button class="tab" aria-label="Open CLEAR">CLEAR</button>
        `;

        fillListing(root);
        root.querySelector(".collapse").addEventListener("click", () => collapseSidebar(host));
        root.querySelector(".tab").addEventListener("click", () => openSidebar(host));

        document.body.appendChild(host);

        // Waiting a couple frames so the browser sees it parked offscreen first, otherwise it pops in instead of sliding.
        if(!collapsed) requestAnimationFrame(() => requestAnimationFrame(() => openSidebar(host)));
    }

function unmountSidebar()
    {
        document.getElementById(HOST_ID)?.remove();
    }

function update()
    {
        if(!shouldShow())
            {
                unmountSidebar();
                return;
            }

        const host = document.getElementById(HOST_ID);
        if(host) fillListing(host.shadowRoot);
        else mountSidebar();
    }

// The toolbar icon was clicked, so open it if it's tucked away or missing, and tuck it away if it's out.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) =>
    {
        if(message.type !== "clear:toggle") return;
        forced = true;

        const host = document.getElementById(HOST_ID);

        if(!host)
            {
                collapsed = false;
                mountSidebar();
            }
        else if(host.hasAttribute("data-open")) collapseSidebar(host);
        else openSidebar(host);

        sendResponse({ ok: true });
    });

// Facebook swaps pages without a real reload, so keep an eye on the URL ourselves.
setInterval(() =>
    {
        if(location.href === lastUrl) return;
        lastUrl = location.href;
        update();
    }, 1000);

update();
