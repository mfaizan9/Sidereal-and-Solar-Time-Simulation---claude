# Conversion Notes — Sidereal and Solar Time Simulator

## Behavior model (one paragraph)

The simulator has a **single degree of freedom: the solar time** (`solarTime`, in
decimal days; integers are midnight). It is initialized to `0.5` — solar noon on the
vernal equinox, which the original defines as the epoch. Everything else is derived
from it: *solar days since the vernal equinox* `= (solarTime − 0.5) mod tropicalYear`;
*sidereal time* `= (solarTime − 0.5) × siderealPerSolar`; the **solar clock** shows
`frac(solarTime)` (one revolution per 24 h), the **sidereal clock** shows
`frac(siderealTime)`; the **orbit angle** `= (daysSinceVE / tropicalYear) × 2π`, and
the Earth-globe group is rotated by `180 − frac(solarTime)·360 − angle·(180/π)` so the
standing figure shows the observer's local solar time. The original is always in
**SIMPLE mode** (`tropicalYear = 365`, `siderealPerSolar = 366/365`); the Julian-mode
toggle exists in `TimeMaster` but was never wired to any control in `Main.as`, so it is
unreachable here too. The user changes `solarTime` by dragging the globe (day), the
figure (time of day), or either clock's hands; by the day-of-year slider; or by the
advance / "go to" / season buttons — each animated with the original eased timing.

## Source = ground truth for behavior (AS3)

Top-level `.as` files are **ActionScript 3** (package/class/getters), not AS1 — ported
directly to JS classes. Files that drove the port:

| AS source | Ported to (simulation.js) |
|---|---|
| `TimeMaster.as` | `TimeMaster` class — all time math, `isAt*` tests, `setSolarTime`/increment family. Timer(20) → `requestAnimationFrame`; `getTimer()` → `performance.now()`; timing constants unchanged. |
| `astroUNL/utils/easing/CubicEaser.as` | `CubicEaser` — ported verbatim (cubic-spline eased animation). |
| `Main.as` | controller wiring: `goToFractionOfYear`/`goToSolarTimeOfDay`/`goToSiderealTimeOfDay`/`getNextTimeWithFraction` ported verbatim; button handlers keep the exact animation durations (1000 ms / 2000 ms); `setButtonHighlighted` → `aria-pressed` + highlight class. |
| `OrbitView.as` | orbit draw + globe/figure drag math (atan2 offset, ±π normalize, whole-day `round`, Shift = sidereal-day snapping). |
| `AnalogClock.as` / `AnalogClockHand.as` | clock draw + hand drag (`atan2 + 90 − rotation` offset, hour→`/360`, minute→`/(360·24)`). |
| `DayOfYearSlider.as` | day slider (incremental `tropicalYear/barWidth` mapping → native `<input type="range">`). |

Constants and on-screen number formatting are verbatim: epoch `0.5`, `tropicalYear 365`,
`siderealPerSolar (365+1)/365`, readouts via `toFixed(3)`. Verified against the AS:
e.g. from the initial state, **go to midnight** → `solarTime 1.0`, readout `0.500` /
sidereal `0.501`; **advance 10 solar days** → `10.500` / `10.529`; **reset** → `0.000`,
noon, "at the vernal equinox".

## Reused exported assets vs. code-drawn

Reused **as-is** (rendered sprite bitmaps from the JPEXS export, copied to `assets/`,
never redrawn):

- `assets/clock-face.png` — exported clock face (tick ring + `0..23` hour numerals), from `DefineSprite_154`.
- `assets/earth.png` — exported Earth globe texture, from `DefineSprite_174`.
- `assets/figure.png` — exported standing-observer figure, from `DefineSprite_180` (`OrbitViewFigure`).
- `assets/fonts/Verdana.ttf` + `Verdana-Bold.ttf` — the original embedded Verdana subset (`1_Verdana` Regular, `3_Verdana` Bold).
- `assets/fonts/aries.ttf` — the original's 3 KB Lucida Sans Unicode subset (`186_…`), self-hosted so the ♈ (U+2648) readout glyph is OS-independent (scoped via `unicode-range`).

**Code-drawn** (genuinely runtime-drawn geometry with no exported file — reproduced on
the 2D canvas with matching geometry/motion): the **Sun** (radial gradient), the
**orbit ring**, the two **clock hands** + center pivot, and the small **am/pm** labels
on the solar clock. Exact original stage pixel coordinates are **not** reproduced
(per the KL-UNL goal); only the angle conventions and time-mapping math are preserved,
and those are radius-independent, so the drag/snap math matches the original at any
display size.

## contents.json entry (added to `html5/foundation/contents.json`)

Added the `"siderealSolarTime"` key (alphabetically, before `smallAngleDemo`) with
`meta.title = "Sidereal and Solar Time Simulator"`, `meta.version = "2.0 (Accessible
HTML5)"`, an empty `help.content` (so the Help button is suppressed — see below), and
`about.content` derived from the original About text (astro.unl.edu / NAAP, NSF grants
#0231270 and #0404988, the non-commercial permission notice) reflowed into the sibling
entries' accessibility boilerplate.

## Deviations / decisions (none change the physics)

- **No Help text.** The decompiled `Help` symbol (symbol 31) is an **empty** MovieClip
  (`Help.as` is a bare class; `assets.swf` contains no help paragraph — only the About
  boilerplate). Per the KL-UNL rule, `help.content` is set to `""`, which suppresses the
  Help button (matching the `smallAngleDemo` sibling). If the canonical original Help
  text is available, paste it into the `siderealSolarTime` entry to restore the button.
- **About version string.** The original About showed `siderealSolarTime003, 11 October
  2010`. The KL-UNL meta uses `2.0 (Accessible HTML5)` like the sibling sims; the
  original funding/permission wording is preserved in the About body.
- **Keyboard equivalents for the four drags.** Pointer dragging (globe, figure, both
  clocks) is preserved exactly; for full keyboard operability each drag also has a
  native control that mutates the **same** `solarTime`: the *day of year* slider (globe),
  the *solar time of day* slider (figure / solar hands), and the *sidereal time of day*
  slider (sidereal hands). All sliders are **incremental** — they add a delta to the
  time, exactly like the original drags — so keyboard and pointer stay perfectly in sync.
- **Day slider display rounding.** The native day slider has `step = 1`, so its thumb
  shows the nearest whole day; the precise fractional value is always in the MathJax
  readout and the slider's `aria-valuetext`.
- **Mode toggle omitted.** `TimeMaster`'s JULIAN mode is ported but, as in the original,
  no control reaches it; the sim runs in SIMPLE mode (365-day year).
- **Readouts are plain text (by request).** The two "…days since ♈ = N.NNN" readouts are
  rendered as plain HTML text rather than MathJax, at the user's explicit instruction
  (a deviation from the pipeline's "all math via MathJax" rule). The remaining math —
  the `0ʰ/6ʰ/12ʰ/18ʰ` superscripts, the `+1`/`+10` advance-button glyphs, and the ♈
  markers on the orbit and slider — is still MathJax. Advance buttons read `+1` / `+10`.
- **Reduced motion.** With `prefers-reduced-motion: reduce`, all button animations use
  duration 0 (the end state is shown instantly). There is no continuous/looping motion
  in this sim (the longest animation is 2 s, user-initiated), so no Pause control is
  needed; Reset is provided by the masthead.
