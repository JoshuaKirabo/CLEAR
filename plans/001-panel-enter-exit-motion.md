# 001 — Give the CLEAR panel a real enter and exit animation

- **Status**: DONE
- **Commit**: 2cd765d
- **Severity**: MEDIUM
- **Category**: Missed opportunities / Easing & duration / Interruptibility
- **Estimated scope**: 2 files (`extension/content.css`, `extension/content.js`), ~30 lines changed

## Problem

The panel the content script injects on marketplace listings teleports on and off screen. There is no motion at all:

```js
// extension/content.js:136-139 — current (end of placePanel)
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.pointerEvents = "";
        panel.style.visibility = "visible";
```

```js
// extension/content.js:168-172 — current (close button)
        panel.querySelector(".clear-close").addEventListener("click", () =>
            {
                dismissed = true;
                panel.remove();
            });
```

```js
// extension/content.js:199-203 — current (URL change on Facebook / Nextdoor)
        // New page means new layout, so hide it and find a fresh empty spot.
        const panel = document.getElementById(PANEL_ID);
        if(!panel) return;
        panel.style.visibility = "hidden";
        schedulePlace();
```

Why it matters:

- The panel shows up ~1s after the page loads (`SETTLE_DELAY`), on top of a page the user is already reading. A hard pop-in at that moment reads as an ad or a glitch. A short rise and fade tells the eye "something arrived here" without stealing attention.
- Closing it makes it vanish instantly, and on Facebook it blinks out and back in when switching listings. Both feel broken.
- Visibility is toggled with an inline `style.visibility`, which cannot be animated. The fix moves show/hide to a `data-open` attribute plus CSS transitions.

Frequency: a user browsing listings sees this tens of times a session. That means the motion must be short and subtle — no bounce, no slide from offscreen, under 250ms.

## Target

**Enter** (closed → open): opacity `0 → 1`, transform `translateY(8px) scale(0.97) → none`, **200ms**, `cubic-bezier(0.23, 1, 0.32, 1)`.

**Exit** (open → closed): same properties reversed, **150ms**, same curve. Exits are faster than entrances.

**Mechanism**: CSS **transitions**, not `@keyframes`. On Facebook the panel can be closed and reopened quickly when the URL changes. Transitions pick up from wherever the panel currently is; keyframes would restart from zero and visibly jump.

**Visibility** is driven by CSS too: the closed state uses `visibility: hidden` delayed until the fade finishes (`visibility 0s linear 150ms`), so the panel stays out of `document.elementFromPoint` hit-testing when closed, but the exit fade is still visible.

**Transform origin**: leave the default (`center`). The panel isn't anchored to a trigger, so it should grow in place, like a toast.

**Reduced motion**: under `prefers-reduced-motion: reduce`, drop the transform entirely and keep only the opacity fade.

```css
/* extension/content.css — target for the #clear-panel rule (only the new lines are marked) */
#clear-panel
   {
      all: initial;
      --clear-ease-out: cubic-bezier(0.23, 1, 0.32, 1);                 /* new */
      position: fixed;
      top: 80px;
      right: 16px;
      z-index: 2147483647;
      width: 260px;
      padding: 16px;
      border-radius: 12px;
      background: #f8fafc;
      color: #0f172a;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      opacity: 0;                                                       /* new */
      visibility: hidden;                                               /* new */
      transform: translateY(8px) scale(0.97);                           /* new */
      transition: opacity 150ms var(--clear-ease-out), transform 150ms var(--clear-ease-out), visibility 0s linear 150ms;   /* new */
   }
```

(The `/* new */` markers are for this plan only — do NOT copy them into the file.)

```css
/* extension/content.css — new rules, placed directly after the #clear-panel rule */
/* Coming in a little slower than it leaves, and it rises up a few pixels as it fades in. */
#clear-panel[data-open]
   {
      opacity: 1;
      visibility: visible;
      transform: none;
      transition: opacity 200ms var(--clear-ease-out), transform 200ms var(--clear-ease-out), visibility 0s;
   }

@media (prefers-reduced-motion: reduce)
   {
      #clear-panel,
      #clear-panel[data-open]
         {
            transform: none;
         }
   }
```

## Repo conventions to follow

- **Brace style (required)**: Josh's own-line brace layout. In CSS the `{` sits on its own line indented 3 spaces, declarations indented 6, and the `}` aligns with the `{`. Nested rules (like `@media`) use the same layout recursively. No one-line rules. Exemplar: `extension/content.css:2-17` (the existing `#clear-panel` rule).
- **JS**: `{` on its own line indented 4 spaces past its owner, body 4 more, `if(` with no space, and a single-statement `if` stays one line with no braces. Exemplar: `extension/content.js:142-150` (`schedulePlace`).
- **Comments**: plain, casual, concrete. "Hidden until we know where it goes, so it doesn't flash in the wrong spot." — not polished doc-speak.
- There are no existing motion tokens. Declare the one curve as a custom property on `#clear-panel` itself (as shown above) — `all: initial` does not reset custom properties, so it is safe there. Do not create a separate tokens file.
- No build step and no linter exist — the extension is loaded unpacked.

## Steps

1. **`extension/content.css`** — in the `#clear-panel` rule, add the five new lines shown in Target (`--clear-ease-out`, `opacity`, `visibility`, `transform`, `transition`). Keep every existing declaration as-is. Add `--clear-ease-out` right after `all: initial;` and the other four at the end of the rule.

2. **`extension/content.css`** — directly after the `#clear-panel` rule (before `#clear-panel .clear-header`), add the `#clear-panel[data-open]` rule and the `@media (prefers-reduced-motion: reduce)` block exactly as shown in Target, including the comment above `[data-open]`.

3. **`extension/content.js`, `placePanel`** — delete line 108:
   ```js
           panel.style.visibility = "hidden";
   ```
   Keep line 107 (`panel.style.pointerEvents = "none";`) — it is what lets the scan see through the panel when it's already open (e.g. on resize).

4. **`extension/content.js`, end of `placePanel`** — replace line 139:
   ```js
           panel.style.visibility = "visible";
   ```
   with:
   ```js
           panel.setAttribute("data-open", "");
   ```
   The `panel.offsetWidth` reads earlier in `placePanel` already force a style flush, so the browser has the closed state computed and the transition will run. Do not add `requestAnimationFrame` or a forced reflow.

5. **`extension/content.js`** — add a constant under `const CELL = 20;` (line 4):
   ```js
   // Has to match the 150ms exit transition in content.css.
   const EXIT_DURATION = 150;
   ```

6. **`extension/content.js`, close button handler (lines 168-172)** — replace the body so the panel animates out before it's removed:
   ```js
           panel.querySelector(".clear-close").addEventListener("click", () =>
               {
                   dismissed = true;
                   panel.removeAttribute("data-open");
                   setTimeout(() => panel.remove(), EXIT_DURATION);
               });
   ```

7. **`extension/content.js`, `showPanel`** — replace lines 174-175:
   ```js
           // Hidden until we know where it goes, so it doesn't flash in the wrong spot.
           panel.style.visibility = "hidden";
   ```
   with:
   ```js
           // Starts closed (hidden by the CSS) until we know where it goes, so it doesn't flash in the wrong spot.
   ```
   Leave `document.body.appendChild(panel);` and `schedulePlace();` untouched.

8. **`extension/content.js`, URL-change interval (lines 199-203)** — replace:
   ```js
           panel.style.visibility = "hidden";
   ```
   with:
   ```js
           panel.removeAttribute("data-open");
   ```
   and update the comment above to:
   ```js
           // New page means new layout, so fade it out and find a fresh empty spot.
   ```

9. Confirm nothing else in `content.js` still sets `style.visibility`: `grep -n "visibility" extension/content.js` should return no matches.

## Boundaries

- Do NOT touch `placePanel`'s scanning logic, `mapScreen`, `isBusy`, `SETTLE_DELAY`, or the manifest.
- Do NOT touch `extension/popup.*` or `extension/background.js`.
- Do NOT change the panel's markup, size, colors, or shadow — motion properties only.
- Do NOT use `@keyframes`, `@starting-style`, or any animation library. No new dependencies.
- Do NOT animate `top`/`left` — when the panel moves (resize), it should jump, not glide. Animating those properties causes the browser to recompute layout every frame.
- `hidePanel()` (leaving the marketplace entirely) stays an instant `remove()` — the page itself is changing, no exit animation needed.
- If any quoted "current" code doesn't match the file (drift since commit `2cd765d`), STOP and report instead of improvising.

## Verification

- **Mechanical**:
  - `node --check extension/content.js` → no output, exit 0.
  - `grep -n "visibility" extension/content.js` → no matches.
  - `grep -n "data-open" extension/content.js` → 3 matches (placePanel, close handler, URL interval).
- **Feel check** — reload the extension at `chrome://extensions` (↻ on the CLEAR card), then open a Facebook Marketplace listing:
  - About 1s after load, the panel rises a few pixels and fades in where it lands. It should never appear first in one spot and then jump to another.
  - It should feel quick and settle softly — no bounce, no overshoot, nothing that reads as "sliding in from somewhere."
  - Click ×: it shrinks slightly and fades out faster than it came in, then is gone (no leftover invisible box blocking clicks — click where it was and confirm the page responds).
  - Click a different listing in the Facebook grid: the panel fades out, then ~1s later fades back in at its new spot. It never blinks.
  - Click two listings rapidly: no visible jump or restart-from-zero flash.
  - DevTools → ⋮ → More tools → **Animations**, set playback to **10%**, and replay the entrance: opacity and the 8px rise should finish together, and most of the movement should happen at the start, slowing down as it settles.
  - DevTools → ⋮ → More tools → **Rendering** → "Emulate CSS media feature prefers-reduced-motion: reduce". Reload: the panel now only fades — no rise, no scale.
- **Done when**: all mechanical checks pass, and the enter/exit/listing-switch behaviors above are confirmed by eye on Facebook Marketplace and on one non-Facebook site (e.g. an eBay `/itm/` page).
