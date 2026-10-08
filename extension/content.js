// Runs inside marketplace pages and drops the CLEAR panel wherever there's empty space.
const PANEL_ID = "clear-panel";
const MARGIN = 16;
const CELL = 20;

// Has to match the 150ms exit transition in content.css.
const EXIT_DURATION = 150;

// Stuff we never want to cover up, like photos, buttons, and links.
const BUSY_TAGS = "img, video, canvas, svg, picture, iframe, button, a, input, textarea, select";

// Giving the page a second to finish loading the listing before we look for space.
const SETTLE_DELAY = 1000;

let lastUrl = location.href;
let dismissed = false;
let placeTimer = null;

function onMarketplace()
    {
        // Facebook only counts once you're inside Marketplace, not on the feed.
        if(location.hostname.endsWith("facebook.com")) return location.pathname.startsWith("/marketplace");

        // Same deal with Nextdoor, only the For Sale & Free section.
        if(location.hostname.endsWith("nextdoor.com")) return location.pathname.startsWith("/for_sale_and_free");
        return true;
    }

function parseColor(value)
    {
        const parts = value.match(/[\d.]+/g);
        if(!parts) return null;
        return { rgb: parts.slice(0, 3).map(Number), alpha: parts.length > 3 ? Number(parts[3]) : 1 };
    }

// Walks up until it finds an element that actually paints a background color.
function backgroundOf(el)
    {
        for(let node = el; node && node.nodeType === Node.ELEMENT_NODE; node = node.parentElement)
            {
                const color = parseColor(getComputedStyle(node).backgroundColor);
                if(color && color.alpha > 0.5) return color.rgb;
            }

        return [255, 255, 255];
    }

function sameColor(a, b)
    {
        return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 30;
    }

function isBusy(el, pageColors, cache)
    {
        if(!el) return true;
        if(cache.has(el)) return cache.get(el);

        let busy = false;

        if(el.closest(BUSY_TAGS)) busy = true;
        else if(getComputedStyle(el).backgroundImage !== "none") busy = true;

        // Black photo viewers and gray cards aren't whitespace, only the page's own background is.
        else if(!pageColors.some((color) => sameColor(backgroundOf(el), color))) busy = true;
        else
            {
                // Actual words sitting right inside this element.
                for(const node of el.childNodes)
                    {
                        if(node.nodeType === Node.TEXT_NODE && node.textContent.trim()) busy = true;
                    }
            }

        cache.set(el, busy);
        return busy;
    }

// Chops the screen into little squares and marks which ones have something in them.
function mapScreen(pageColors)
    {
        const cols = Math.floor(window.innerWidth / CELL);
        const rows = Math.floor(window.innerHeight / CELL);
        const cache = new Map();

        // Running totals so we can count the busy squares under any rectangle instantly.
        const sums = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));

        for(let row = 0; row < rows; row++)
            {
                for(let col = 0; col < cols; col++)
                    {
                        const el = document.elementFromPoint(col * CELL + CELL / 2, row * CELL + CELL / 2);
                        const busy = isBusy(el, pageColors, cache) ? 1 : 0;
                        sums[row + 1][col + 1] = busy + sums[row][col + 1] + sums[row + 1][col] - sums[row][col];
                    }
            }

        return { cols, rows, sums };
    }

function placePanel(panel)
    {
        const body = backgroundOf(document.body);
        const pageColors = [body];

        // Light pages like Facebook sit on gray with white columns, and both of those count as empty.
        if(body[0] + body[1] + body[2] > 600) pageColors.push([255, 255, 255]);

        // Letting the scan see through the panel so it doesn't count itself as clutter.
        panel.style.pointerEvents = "none";

        const { cols, rows, sums } = mapScreen(pageColors);

        // One extra square around the card so it isn't jammed right up against stuff.
        const wide = Math.ceil(panel.offsetWidth / CELL) + 2;
        const tall = Math.ceil(panel.offsetHeight / CELL) + 2;

        let best = null;

        for(let row = 0; row + tall <= rows; row++)
            {
                for(let col = 0; col + wide <= cols; col++)
                    {
                        const busy = sums[row + tall][col + wide] - sums[row][col + wide] - sums[row + tall][col] + sums[row][col];

                        // When there's a tie, the spot closest to the top right corner wins.
                        const distance = (cols - col - wide) + row;

                        if(best && (busy > best.busy || (busy === best.busy && distance >= best.distance))) continue;
                        best = { busy, distance, row, col };
                    }
            }

        // Nothing fits at all on tiny windows, so just fall back to the top right.
        const left = best ? (best.col + 1) * CELL : window.innerWidth - panel.offsetWidth - MARGIN;
        const top = best ? (best.row + 1) * CELL : MARGIN;

        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.pointerEvents = "";
        panel.setAttribute("data-open", "");
    }

function schedulePlace()
    {
        clearTimeout(placeTimer);
        placeTimer = setTimeout(() =>
            {
                const panel = document.getElementById(PANEL_ID);
                if(panel) placePanel(panel);
            }, SETTLE_DELAY);
    }

function showPanel()
    {
        if(document.getElementById(PANEL_ID)) return;

        const panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <div class="clear-header">
                <span class="clear-title">CLEAR</span>
                <button class="clear-close" aria-label="Close">&times;</button>
            </div>
            <p class="clear-site"></p>
            <p class="clear-status">Risk check coming soon.</p>
        `;

        panel.querySelector(".clear-site").textContent = `Watching ${location.hostname}`;
        panel.querySelector(".clear-close").addEventListener("click", () =>
            {
                dismissed = true;
                panel.removeAttribute("data-open");
                setTimeout(() => panel.remove(), EXIT_DURATION);
            });

        // Starts closed (hidden by the CSS) until we know where it goes, so it doesn't flash in the wrong spot.
        document.body.appendChild(panel);
        schedulePlace();
    }

function hidePanel()
    {
        document.getElementById(PANEL_ID)?.remove();
    }

function update()
    {
        if(onMarketplace() && !dismissed) showPanel();
        else hidePanel();
    }

// Facebook swaps pages without a real reload, so keep an eye on the URL ourselves.
setInterval(() =>
    {
        if(location.href === lastUrl) return;
        lastUrl = location.href;
        dismissed = false;
        update();

        // New page means new layout, so fade it out and find a fresh empty spot.
        const panel = document.getElementById(PANEL_ID);
        if(!panel) return;
        panel.removeAttribute("data-open");
        schedulePlace();
    }, 1000);

window.addEventListener("resize", schedulePlace);

update();
