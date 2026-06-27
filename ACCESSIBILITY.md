# Accessibility Notes — Sidereal and Solar Time Simulator

Target: WCAG 2.1 AA (AAA where reasonable). Built on the KL-UNL foundation
(`kl-unl.css` palette + layout, `<kl-unl-masthead>` for title / Reset / About,
`kl-unl.js` for MathJax equations). Human screen-reader QA is still recommended.

## Structure & landmarks
- One `<h1>` — the simulation title, rendered by the masthead component (the sim does
  not add a competing `h1`). Panels use non-skipping `<h2>` headings.
- `<main class="app-layout">` with four `<section class="panel">` landmarks (Solar Time,
  Sidereal Time, Day of Year, Orbital View), each `aria-labelledby` its heading.
- A "Skip to controls" link is the first focusable element.

## Keyboard map (everything is operable without a mouse)
- **Sliders** (native `<input type="range">`, full support): `←/↓` decrement, `→/↑`
  increment, `PageUp/PageDown` larger step, `Home/End` min/max. Three sliders cover the
  three pointer drags:
  - *Day of year* (steps the orbital day — the globe-drag equivalent).
  - *Solar time of day* (the solar clock-hands / figure-drag equivalent).
  - *Sidereal time of day* (the sidereal clock-hands equivalent).
  Each slider announces a formatted time via `aria-valuetext`; Tab always moves away
  cleanly (no trap), and focus is never stolen by the canvas.
- **Clock hands** are themselves focusable: each clock exposes an hour and a minute
  grip (`role="slider"`, in the Tab order) overlaying its hand. Clicking a hand moves
  focus to that grip; then `←/↓` rotate it counter-clockwise (rewind) and `→/↑` rotate
  clockwise (advance) — hour grip 1 hour/step, minute grip 1 minute/step, `PageUp/Down`
  larger, `Home/End` start/end of day. The focus ring sits along the hand, and the grip
  mutates the same `solarTime` state as the pointer drag.
- **Buttons** (all native `<button>`): advance by 1 / 10 solar or sidereal days; go to
  midnight / sunrise / noon / sunset; go to 0ʰ / 6ʰ / 12ʰ / 18ʰ sidereal; go to the four
  seasons. Reset / About are in the masthead (its dialog manages focus + Escape itself).
- Visible focus ring comes from the foundation `:focus-visible` styling.

## Pointer + touch
- All dragging uses Pointer Events (one path for mouse + touch). Draggable canvases set
  `touch-action: none` so a drag doesn't scroll/zoom the page. Pointer coordinates are
  mapped back through the canvas scale into the original internal coordinate system, so
  the drag/snap math matches the Flash source at any display size and zoom level.
- Targets are ≥ 44 px (the KL-UNL `.button`/control sizing); no hover-only affordances.

## Text alternatives & live regions
- Each canvas is `role="img"` with an `aria-label` and an `aria-describedby` `sr-only`
  region (NOT live) that states what it currently shows (clock reading; Earth's day-of-year
  + the figure's local solar time); it is read when the canvas is reached and updated
  silently from the render path. See the AUDIO / SCREEN-READER PASS section below.
- One global `aria-live="polite"` status region (`#sr-status`) announces meaningful changes
  **on commit**, debounced (~350 ms) so drags/slider scrubs don't flood — e.g. "Solar time
  12 hours 0 minutes PM (noon). Sidereal time 0 hours 0 minutes sidereal time. 0.000 solar
  days since the vernal equinox." Units are spoken as words (see below).
- The active "go to" / season control is reflected with `aria-pressed="true"`. It is
  highlighted with a **color change** (like the original) plus a border **ring** as a
  non-color cue, so it is not signalled by color alone. The highlight adds no text/content,
  so toggling it never resizes or shifts neighboring elements.

## Math is typeset by MathJax (locally vendored, SVG output)
- Math symbols in the HTML are typeset by MathJax: the sidereal-hour superscripts on the
  buttons and orbit ring (`0ʰ 6ʰ 12ʰ 18ʰ`) and the advance `+1`/`+10` glyphs. Right-clicking
  any of them opens the MathJax context menu ("Show Math As → TeX / MathML"); the menu is
  left enabled and the `contextmenu` event is not trapped.
- The ♈ (Aries / vernal-equinox) glyph — in the readouts, the vernal-equinox button, the
  orbit label, and the day-of-year slider marker — is rendered as plain text in the vendored
  `AriesGlyph` font (U+2648), NOT via MathJax: MathJax falls back to the system serif font
  for ♈, which is blank on systems lacking that glyph. The vendored font renders identically
  everywhere.
- **Deviation (by request):** the two "…days since ♈ = N.NNN" readouts are rendered as
  **plain HTML text**, not MathJax (the Aries glyph uses U+2648 + U+FE0E text
  presentation). This departs from the pipeline's "all math via MathJax" rule at the
  user's explicit instruction. Each readout's visible text is `aria-hidden`; a paired
  `sr-only` span carries the spoken prose ("Solar days since the vernal equinox: N. Solar
  time of day …") and is referenced by the sliders' `aria-describedby`.

### Documented MathJax exceptions (canvas-baked art that genuinely cannot move)
The clock **face numerals (`0..23`)** are part of the **reused exported clock-face
bitmap** (`assets/clock-face.png`) and the **am/pm** labels are drawn on the clock
canvas; these cannot expose the MathJax menu. Their information is fully available
accessibly elsewhere: the precise time is in the MathJax readouts, the slider
`aria-valuetext`, the canvas description regions, and the live status. Moving 48
bitmap numerals into positioned MathJax overlays would mean redrawing exported art
(which the pipeline forbids) for no added information, so they are left as-is.

## Color & contrast
- Colors come from the KL-UNL CSS custom properties. The physically meaningful orbit
  (black sky, yellow Sun, blue/green Earth) is preserved but never used as the *only*
  signal — every state is also stated in text/readouts and the live region.

## Motion
- `prefers-reduced-motion: reduce` is honored: button transitions resolve instantly to
  the end state. The longest animation is 2 s and user-initiated; nothing loops, so no
  Pause control is required (Reset is in the masthead).
- **Flash / seizure safety (WCAG 2.3.1):** during fast advances the clock hands (and the
  orbiting figure) would otherwise sweep many times per second. Each spinning element's
  opacity is now scaled by its rotation speed — solid when slow, fading to ~16% once it
  exceeds ~3 revolutions/sec — so a rapid sweep reads as a soft blur rather than a
  strobe. Speed is measured between frames from the state, so it tracks the real motion.

## Zoom / reflow
- Body text is ≥ 1.125 rem and everything is sized in rem/%/clamp, so the layout reflows
  without clipping at 200% zoom and down to phone-portrait width (single column, no
  horizontal scroll). Canvases scale via CSS while keeping their internal coordinates.

---

## AUDIO / SCREEN-READER PASS (audio.txt retrofit)

An audio-only pass was applied so the sim is usable by ear (NVDA / VoiceOver). No
behavior, layout, visuals, physics, or on-screen text changed — only ARIA, spoken
strings, and live-region timing. The spoken-time helper functions are used ONLY in
ARIA (never shown on screen), so their wording is free to spell units out.

### Values made units-complete (quantity + number + unit, units as words)
- **Solar time-of-day slider** `aria-valuetext`: e.g. "12 hours 0 minutes PM (noon)",
  "5 hours 45 minutes PM".
- **Sidereal time-of-day slider** `aria-valuetext`: e.g. "0 hours 0 minutes sidereal time",
  "6 hours 0 minutes sidereal time".
- **Day-of-year slider** `aria-valuetext`: e.g. "0.000 days since the vernal equinox".
- **Readouts** (visible text is `aria-hidden`; paired `sr-only` span carries the prose):
  "Solar days since the vernal equinox: 0.000 days. Solar time of day 12 hours 0 minutes
  PM (noon)." and the sidereal equivalent.
- **Advance buttons** `aria-label`: "advance by one solar day" / "advance by ten solar
  days" (and sidereal). **Sidereal go-to** `aria-label`: "go to 0 hours sidereal", etc.

### Unit-word mappings applied
- time `h : m` (the ":" glyph and bare numbers) → "hours", "minutes"
- "sidereal" / "AM" / "PM" stated explicitly; "noon" / "midnight" appended at those times
- day count → "... days"
- No negative quantities occur in this sim (days-since and times are always ≥ 0), so no
  "minus"/"negative" wording is needed.

### Live-region wording and timing (single polite region: `#sr-status`)
- Example: "Solar time 12 hours 0 minutes PM (noon). Sidereal time 0 hours 0 minutes
  sidereal time. 0.000 solar days since the vernal equinox. At the vernal equinox."
- Announced on COMMIT only, debounced ~350 ms. Every drag move and slider step commits
  the time immediately (duration 0), which previously fired the region on every tick;
  the debounce coalesces those into one announcement after motion stops. Native slider
  `aria-valuetext` still gives immediate per-step feedback while arrowing.
- The three canvas description regions (`solar-clock-desc`, `sidereal-clock-desc`,
  `orbit-desc`) had their `aria-live` REMOVED — they are now silent `aria-describedby`
  targets (read when the canvas is reached), so they no longer double-announce or flood
  during animation. `#sr-status` is the only live region.

### Canvas description approach
- Each `<canvas role="img">` has an `aria-label` plus an `aria-describedby` `sr-only`
  region updated from the single render path, e.g. the orbit: "Top-down view of Earth
  orbiting the Sun. Earth is 0.000 solar days past the vernal equinox; the observer figure
  on Earth shows local solar time 12 hours 0 minutes PM (noon); sidereal time 0 hours 0
  minutes sidereal time."

### Not verified — human listening test still required
Standard ARIA only (no reader-specific hacks), reasoned against the accessibility tree;
no real screen reader was run here. Screen-reader compatibility is NOT claimed as verified
— it must be confirmed by a human listening test on **NVDA (Windows, Chrome + Firefox)**
and **VoiceOver (macOS, Chrome + Safari)**.
