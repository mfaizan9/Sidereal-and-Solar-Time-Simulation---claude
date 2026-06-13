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
- Each canvas is `role="img"` with an `aria-label` and an `aria-describedby` live region
  that states what it currently shows (clock reading; Earth's day-of-year + the figure's
  local solar time).
- A global `aria-live="polite"` status region announces meaningful changes **on commit**
  (button result, animation end, slider release) — not on every animation tick — e.g.
  "Solar time 12:00 am (midnight). Sidereal time 12:02 sidereal. 0.500 solar days since
  the vernal equinox."
- The active "go to" / season control is reflected with `aria-pressed="true"` and is
  **not signalled by color alone** — a check mark (`✓`) and an outline ring back it up.

## Math is typeset by MathJax (locally vendored, SVG output)
- Math symbols in the HTML are typeset by MathJax: the sidereal-hour superscripts on the
  buttons and orbit ring (`0ʰ 6ʰ 12ʰ 18ʰ`), the advance `+1`/`+10` glyphs, and the ♈
  markers on the orbit and day-of-year slider. Right-clicking any of them opens the
  MathJax context menu ("Show Math As → TeX / MathML"); the menu is left enabled and the
  `contextmenu` event is not trapped.
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
  the end state. The longest animation is 2 s and user-initiated; nothing loops, nothing
  flashes more than 3×/sec, so no Pause control is required (Reset is in the masthead).

## Zoom / reflow
- Body text is ≥ 1.125 rem and everything is sized in rem/%/clamp, so the layout reflows
  without clipping at 200% zoom and down to phone-portrait width (single column, no
  horizontal scroll). Canvases scale via CSS while keeping their internal coordinates.
