# Sidereal and Solar Time Simulator (Accessible HTML5)

An accessible HTML5 conversion of the NAAP/UNL "Sidereal and Solar Time" Flash
simulation, built on the shared KL-UNL foundation.

## This sim must be served over HTTP — it will NOT run from a double-clicked file

Opening `index.html` directly (a `file://` path) shows a broken/empty title bar.
**Why:** the KL-UNL masthead component (`foundation/kl-unl-masthead.js`) loads its
title / About text with `fetch('foundation/contents.json')`, and browsers block
`fetch()` of local files under `file://` for security (the same-origin policy).
Served over HTTP the fetch succeeds and the sim loads normally.

## How to run it locally

Serve from **inside this `html5/` folder** (so the sim is at the server root), then
open the printed URL:

```
# Python (3.x)
python3 -m http.server 8123
#   then open  http://localhost:8123/

# Node
npx serve
#   or:  npx http-server

# VS Code
#   Use the "Live Server" extension and "Open with Live Server".
```

Because you serve from inside `html5/`, the sim is at the server root — the URL is
`http://localhost:8123/`, **not** `.../html5/index.html`.

## Production

When deployed to the cloud host (served over HTTP/HTTPS) it just works. The
`file://` limitation only affects local double-clicking.

## Browser / OS compatibility

Works in current Chrome, Edge, Firefox, and **Safari (macOS and iOS)**, on Windows,
macOS, Linux, Android, and iPadOS/iOS. Notes on how cross-platform consistency is
ensured:

- **Baseline:** modern evergreen browsers (Safari ≥ 15.4 / 2022). That floor is set by
  the shared KL-UNL masthead, which uses the native `<dialog>` element; all CSS used here
  (`aspect-ratio`, grid/flex `gap`, `:focus-visible`, custom properties) is supported at
  that baseline.
- **The ♈ (Aries / vernal-equinox) glyph** is self-hosted as a 3 KB webfont
  (`assets/fonts/aries.ttf`, scoped to U+2648 via `unicode-range`) so it renders the same
  on every OS — macOS/Safari would otherwise substitute a color emoji or a different font.
  The Verdana labels baked into the clock canvas are likewise self-hosted. All other math
  symbols are drawn by MathJax as SVG paths (no system-font dependence).
- **Input:** dragging uses Pointer Events with `touch-action: none`, so mouse, trackpad,
  and touch (iPhone/iPad/Android) share one code path; every drag also has a keyboard
  control. `prefers-reduced-motion` uses both the modern and legacy `MediaQueryList` APIs.
- The sim logic is plain ES5 (no transpiling needed) and self-contained (no CDN).

## What's in here

```
index.html          KL-UNL scaffold: .app-shell + <kl-unl-masthead> + panels
foundation/         shared KL-UNL files, copied in UNCHANGED
                      (kl-unl-masthead.js, kl-unl.css, kl-unl.js,
                       contents.json — with this sim's entry added)
styles/styles.css   sim-specific styles only (foundation is never edited)
simulation.js       all sim logic (TimeMaster/CubicEaser port + UI wiring)
assets/             reused exported art + vendored MathJax + Verdana font
README.md           this file
CONVERSION_NOTES.md behavior model, AS->HTML5 mapping, deviations
ACCESSIBILITY.md    WCAG affordances, keyboard map, documented exceptions
```

Everything is local: the only runtime fetches are `foundation/contents.json` and
the locally-vendored MathJax. No CDN, no analytics, no build step.
