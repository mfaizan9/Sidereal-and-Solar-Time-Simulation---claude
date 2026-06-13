/* ============================================================================
   Sidereal and Solar Time Simulator -- HTML5 port of the NAAP/UNL Flash sim.

   Behavior model (ground truth = the decompiled ActionScript 3):
     There is ONE degree of freedom, the SOLAR TIME (decimal days; integers are
     midnight; epoch solarTime = 0.5 = solar noon on the vernal equinox). Every
     readout and view is derived from it:
       - solar days since the vernal equinox = (solarTime - 0.5) mod tropicalYear
       - sidereal time   = (solarTime - 0.5) * siderealPerSolar
       - solar clock     shows frac(solarTime)        (one rev / 24h)
       - sidereal clock  shows frac(siderealTime)
       - orbit position  = (daysSinceVE / tropicalYear) * 2pi
     The original is always in SIMPLE mode (tropicalYear = 365, the Julian-mode
     toggle was never wired to any control), so siderealPerSolar = 366/365.

   Ports kept VERBATIM from the AS: CubicEaser (animation spline), TimeMaster
   (all time math + isAt* tests), OrbitView / AnalogClock(Hand) / DayOfYearSlider
   drag math. Constants and on-screen number formatting (toFixed(3)) are unchanged.

   Presentation follows the KL-UNL foundation + WCAG: native sliders/buttons give
   full keyboard control of the same state the pointer drags mutate; equations and
   math symbols are typeset by MathJax; an aria-live region announces commits.
   ========================================================================== */

(function () {
  "use strict";

  // ----- mode constants (AS: TimeMaster) ------------------------------------
  var SOLAR_TIME_AT_EPOCH = 0.5;          // AS const: noon on the vernal equinox
  var SIMPLE = "simple", JULIAN = "julian";

  /* ==========================================================================
     CubicEaser -- ported verbatim from astroUNL.utils.easing.CubicEaser.
     (Drives the eased button animations; preserves exact motion.)
     ========================================================================== */
  function CubicEaser(v) {
    this.targetValue = 0; this.slope0 = 0; this.slope1 = 0;
    this.parametersList = null; this.startValue = 0;
    this.splinePointsList = null; this.startTime = 0; this.targetTime = 0;
    this.init(v);
  }
  CubicEaser.prototype.init = function (v) { this.setTarget(0, v, 1, v); };
  CubicEaser.prototype.doComputations = function () {
    this.splinePointsList.sort(function (a, b) { return a.x - b.x; });
    var p = this.splinePointsList;
    var n = p.length, last = n - 1, secondLast = n - 2;
    var s0 = this.slope0, s1 = this.slope1;
    var u = [], i, sig, pp;
    p[0].d2 = -0.5;
    u[0] = 3 / (p[1].x - p[0].x) * ((p[1].y - p[0].y) / (p[1].x - p[0].x) - s0);
    for (i = 1; i < last; i++) {
      sig = (p[i].x - p[i - 1].x) / (p[i + 1].x - p[i - 1].x);
      pp = sig * p[i - 1].d2 + 2;
      p[i].d2 = (sig - 1) / pp;
      u[i] = (p[i + 1].y - p[i].y) / (p[i + 1].x - p[i].x) - (p[i].y - p[i - 1].y) / (p[i].x - p[i - 1].x);
      u[i] = (6 * u[i] / (p[i + 1].x - p[i - 1].x) - sig * u[i - 1]) / pp;
    }
    var qn = 0.5;
    var un = 3 / (p[last].x - p[secondLast].x) * (s1 - (p[last].y - p[secondLast].y) / (p[last].x - p[secondLast].x));
    p[last].d2 = (un - qn * u[secondLast]) / (qn * p[secondLast].d2 + 1);
    for (i = secondLast; i >= 0; i--) { p[i].d2 = p[i].d2 * p[i + 1].d2 + u[i]; }
    var params = [], lo, hi, d2lo, d2hi, xlo, xhi, ylo, yhi, h, a, b, c, d;
    for (i = 0; i < last; i++) {
      lo = p[i]; hi = p[i + 1];
      d2lo = lo.d2; d2hi = hi.d2; xlo = lo.x; xhi = hi.x; ylo = lo.y; yhi = hi.y;
      h = xhi - xlo;
      a = (d2hi - d2lo) / (6 * h);
      b = (3 * xhi * d2lo - 3 * d2hi * xlo) / (6 * h);
      c = (-6 * ylo + 2 * xhi * d2hi * xlo - xhi * xhi * d2hi - 2 * xhi * d2lo * xlo + d2lo * xlo * xlo - 2 * xhi * xhi * d2lo + 6 * yhi + 2 * d2hi * xlo * xlo) / (6 * h);
      d = (-2 * d2hi * xhi * xlo * xlo + 2 * d2lo * xhi * xhi * xlo + d2hi * xhi * xhi * xlo - 6 * yhi * xlo + 6 * ylo * xhi - d2lo * xhi * xlo * xlo) / (6 * h);
      params.push({ xUpper: xhi, a: a, b: b, c: c, d: d });
    }
    this.parametersList = params;
  };
  CubicEaser.prototype.setTarget = function (t0, v0, t1, v1) {
    if (typeof v0 !== "number") { v0 = this.getValue(t0); this.slope0 = this.getDerivative(t0); }
    else { this.slope0 = 0; }
    this.startTime = t0; this.startValue = v0;
    this.splinePointsList = [{ x: t0, y: v0 }, { x: t1, y: v1 }];
    this.doComputations();
    this.targetTime = t1; this.targetValue = v1;
    return { a: this.parametersList[0].a, b: this.parametersList[0].b, c: this.parametersList[0].c, d: this.parametersList[0].d };
  };
  CubicEaser.prototype.getValue = function (t) {
    var p = this.parametersList, n = p.length, i = 0;
    for (; i < n; i++) { if (t < p[i].xUpper) break; }
    if (i < n) return p[i].d + t * (p[i].c + t * (p[i].b + t * p[i].a));
    return this.targetValue;
  };
  CubicEaser.prototype.getDerivative = function (t) {
    var p = this.parametersList, n = p.length, i = 0;
    for (; i < n; i++) { if (t < p[i].xUpper) break; }
    if (i < n) return p[i].c + t * (2 * p[i].b + 3 * t * p[i].a);
    return 0;
  };

  /* ==========================================================================
     TimeMaster -- ported verbatim from TimeMaster.as (getter logic preserved).
     The animation timer (AS Timer(20)) becomes a requestAnimationFrame loop using
     performance.now() in place of getTimer(); timing constants are unchanged.
     ========================================================================== */
  function TimeMaster() {
    this._easer = new CubicEaser(0);
    this._timerOffset = 0;
    this._running = false;
    this._rafId = 0;
    this._latestSolarTime = 0;
    this.responder = null;
    this.setMode(SIMPLE);   // also sets solarTime to 0.5
  }
  TimeMaster.prototype.setMode = function (m) {
    if (m === SIMPLE) { this._mode = m; this._tropicalYear = 365; }
    else if (m === JULIAN) { this._mode = m; this._tropicalYear = 365.25; }
    else throw new Error("mode not supported");
    this._siderealPerSolar = (this._tropicalYear + 1) / this._tropicalYear;
    this._toSummer = 0.25 * this._tropicalYear;
    this._toAutumn = 0.5 * this._tropicalYear;
    this._toWinter = 0.75 * this._tropicalYear;
    if (this.responder) this.responder.onTimeMasterModeChanged();
    this.setSolarTime(SOLAR_TIME_AT_EPOCH);
  };
  Object.defineProperty(TimeMaster.prototype, "isAnimating", { get: function () { return this._running; } });
  Object.defineProperty(TimeMaster.prototype, "tropicalYear", { get: function () { return this._tropicalYear; } });
  Object.defineProperty(TimeMaster.prototype, "siderealPerSolar", { get: function () { return this._siderealPerSolar; } });
  Object.defineProperty(TimeMaster.prototype, "solarTime", { get: function () { return this._easer.targetValue; } });
  Object.defineProperty(TimeMaster.prototype, "latestSolarTime", { get: function () { return this._running ? this._latestSolarTime : this.solarTime; } });
  TimeMaster.prototype.timesAreEqual = function (a, b) { return Math.abs(a - b) < 1e-6; };

  // solar / sidereal "days since the last vernal equinox" (AS getters)
  Object.defineProperty(TimeMaster.prototype, "solarDaysSinceLastVernalEquinox", {
    get: function () { var y = this._tropicalYear; return ((this.solarTime - SOLAR_TIME_AT_EPOCH) % y + y) % y; }
  });
  Object.defineProperty(TimeMaster.prototype, "latestSolarDaysSinceLastVernalEquinox", {
    get: function () { var y = this._tropicalYear; return ((this.latestSolarTime - SOLAR_TIME_AT_EPOCH) % y + y) % y; }
  });
  Object.defineProperty(TimeMaster.prototype, "siderealDaysSinceLastVernalEquinox", {
    get: function () { return this.solarDaysSinceLastVernalEquinox * this._siderealPerSolar; }
  });
  Object.defineProperty(TimeMaster.prototype, "latestSiderealDaysSinceLastVernalEquinox", {
    get: function () { return this.latestSolarDaysSinceLastVernalEquinox * this._siderealPerSolar; }
  });
  TimeMaster.prototype.getSiderealTimeForSolarTime = function (s) { return (s - SOLAR_TIME_AT_EPOCH) * this._siderealPerSolar; };
  TimeMaster.prototype.getSolarTimeForSiderealTime = function (sid) { return (sid / this._siderealPerSolar) + SOLAR_TIME_AT_EPOCH; };
  Object.defineProperty(TimeMaster.prototype, "siderealTime", { get: function () { return this.getSiderealTimeForSolarTime(this.solarTime); } });
  Object.defineProperty(TimeMaster.prototype, "latestSiderealTime", { get: function () { return this.getSiderealTimeForSolarTime(this.latestSolarTime); } });

  // "at this instant?" tests (used to highlight the go-to / season buttons)
  function frac01(t) { return (t % 1 + 1) % 1; }
  TimeMaster.prototype._atDayFrac = function (timeVal, f) {
    var t = frac01(timeVal);
    if (f === 0) return this.timesAreEqual(t, 0) || this.timesAreEqual(t - 1, 0);
    return this.timesAreEqual(t, f);
  };
  // latest-* variants (used while animating) -- identical math on latest values
  TimeMaster.prototype.latestIsAtMidnight = function () { return this._atDayFrac(this.latestSolarTime, 0); };
  TimeMaster.prototype.latestIsAtSunrise = function () { return this._atDayFrac(this.latestSolarTime, 0.25); };
  TimeMaster.prototype.latestIsAtNoon = function () { return this._atDayFrac(this.latestSolarTime, 0.5); };
  TimeMaster.prototype.latestIsAtSunset = function () { return this._atDayFrac(this.latestSolarTime, 0.75); };
  TimeMaster.prototype.latestIsAt0h = function () { return this._atDayFrac(this.latestSiderealTime, 0); };
  TimeMaster.prototype.latestIsAt6h = function () { return this._atDayFrac(this.latestSiderealTime, 0.25); };
  TimeMaster.prototype.latestIsAt12h = function () { return this._atDayFrac(this.latestSiderealTime, 0.5); };
  TimeMaster.prototype.latestIsAt18h = function () { return this._atDayFrac(this.latestSiderealTime, 0.75); };
  TimeMaster.prototype.latestIsAtVernalEquinox = function () {
    var d = this.latestSolarDaysSinceLastVernalEquinox;
    return this.timesAreEqual(d, 0) || this.timesAreEqual(d - this._tropicalYear, 0);
  };
  TimeMaster.prototype.latestIsAtSummerSolstice = function () { return this.timesAreEqual(this.latestSolarDaysSinceLastVernalEquinox, this._toSummer); };
  TimeMaster.prototype.latestIsAtAutumnalEquinox = function () { return this.timesAreEqual(this.latestSolarDaysSinceLastVernalEquinox, this._toAutumn); };
  TimeMaster.prototype.latestIsAtWinterSolstice = function () { return this.timesAreEqual(this.latestSolarDaysSinceLastVernalEquinox, this._toWinter); };

  // ----- setters (AS setSolarTime + the increment family) -------------------
  TimeMaster.prototype.setSolarTime = function (arg, dur) {
    dur = dur || 0;
    if (dur === 0) { this._stopAnimatingWith(arg); }
    else {
      if (!this._running) {
        this._timerOffset = now();
        this._running = true;
        this._easer.setTarget(0, this.solarTime, dur, arg);
        this._latestSolarTime = this.solarTime;
        if (this.responder) this.responder.onTimeMasterAnimationStart();
        this._startLoop();
      } else {
        var t = now() - this._timerOffset;
        this._easer.setTarget(t, null, t + dur, arg);
      }
    }
  };
  TimeMaster.prototype.setSiderealTime = function (arg, dur) { this.setSolarTime(this.getSolarTimeForSiderealTime(arg), dur); };
  TimeMaster.prototype._stopAnimatingWith = function (solar) {
    this._easer.init(solar);
    this._latestSolarTime = solar;
    if (this._running) {
      this._running = false;
      if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = 0; }
      if (this.responder) this.responder.onTimeMasterAnimationStop();
    }
    if (this.responder) this.responder.onTimeMasterTimeChanged();
  };
  TimeMaster.prototype.incrementSolarTime = function (d, dur) { this.setSolarTime(this.solarTime + d, dur); };
  TimeMaster.prototype.incrementSiderealTime = function (d, dur) { this.setSolarTime(this.solarTime + d / this._siderealPerSolar, dur); };
  TimeMaster.prototype.incrementLatestSolarTime = function (d, dur) { this.setSolarTime(this.latestSolarTime + d, dur); };
  TimeMaster.prototype.incrementLatestSiderealTime = function (d, dur) { this.setSolarTime(this.latestSolarTime + d / this._siderealPerSolar, dur); };
  TimeMaster.prototype._startLoop = function () {
    var self = this;
    function tick() {
      if (!self._running) return;
      var t = now() - self._timerOffset;
      if (t > self._easer.targetTime) { self._stopAnimatingWith(self.solarTime); }
      else {
        self._latestSolarTime = self._easer.getValue(t);
        if (self.responder) self.responder.onTimeMasterAnimationUpdate();
        self._rafId = requestAnimationFrame(tick);
      }
    }
    self._rafId = requestAnimationFrame(tick);
  };

  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function requestAnimationFrame(cb) { return window.requestAnimationFrame(cb); }
  function cancelAnimationFrame(id) { return window.cancelAnimationFrame(id); }

  /* ==========================================================================
     Main controller -- the ITimeMasterResponder, plus the KL-UNL UI wiring.
     ========================================================================== */
  var tm = new TimeMaster();
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function dur(ms) { return reduceMotion.matches ? 0 : ms; }   // honor reduced motion

  // ---- Main.as helpers: "go to" navigation (ported verbatim) ---------------
  function getNextTimeWithFraction(currentTime, fraction) {
    fraction = (fraction % 1 + 1) % 1;
    var currInt = Math.floor(currentTime);
    var currFrac = currentTime - currInt;
    if ((fraction - currFrac) < 1e-8) currInt += 1;
    return currInt + fraction;
  }
  function goToFractionOfYear(fractionOfYear, animationDuration) {
    var t = (tm.latestSolarTime - SOLAR_TIME_AT_EPOCH) / tm.tropicalYear;
    t = getNextTimeWithFraction(t, fractionOfYear);
    t = SOLAR_TIME_AT_EPOCH + t * tm.tropicalYear;
    if (!tm.timesAreEqual(tm.solarTime, t)) tm.setSolarTime(t, animationDuration);
  }
  function goToSolarTimeOfDay(solarTimeOfDay, animationDuration) {
    var t = getNextTimeWithFraction(tm.latestSolarTime, solarTimeOfDay);
    if (!tm.timesAreEqual(tm.solarTime, t)) tm.setSolarTime(t, animationDuration);
  }
  function goToSiderealTimeOfDay(siderealTimeOfDay, animationDuration) {
    var t = getNextTimeWithFraction(tm.latestSiderealTime, siderealTimeOfDay);
    if (!tm.timesAreEqual(tm.siderealTime, t)) tm.setSiderealTime(t, animationDuration);
  }

  // ---- DOM references -------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  var solarCanvas, sidCanvas, orbitCanvas;
  var solarTimeRange, sidTimeRange, dayRange;
  var img = { earth: null, figure: null, face: null };

  // ---- assets ---------------------------------------------------------------
  function loadImage(src) {
    var im = new Image();
    im.src = src;
    im.onload = function () { render(); };
    return im;
  }

  /* ==========================================================================
     RENDERING -- one render() redraws both clocks + the orbit from state and
     syncs the DOM readouts, sliders, button highlights, and live regions.
     Canvas keeps the original internal coordinate system; CSS scales it.
     ========================================================================== */
  var ORBIT = { w: 520, cx: 260, cy: 260, R: 175, globeR: 27, figH: 22, figW: 16 };
  var CLOCK = { w: 258, cx: 129, cy: 129, hourLen: 60, minLen: 92 };
  var ANGLE_AT_EQUINOX = -Math.PI / 2;     // AS OrbitView._angleOfEarthAtEquinox
  var GLOBE_ROT_OFFSET = 180;              // AS OrbitView._globeRotationOffset

  function setupCanvasDPR(canvas, logicalW, logicalH) {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(logicalW * dpr);
    canvas.height = Math.round(logicalH * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function drawClock(canvas, fractionOfDay, showAmPm) {
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CLOCK.w, CLOCK.w);
    // reused exported face bitmap (ticks + 0..23 numerals) -- never redrawn
    if (img.face && img.face.complete) ctx.drawImage(img.face, 0, 0, CLOCK.w, CLOCK.w);

    if (showAmPm) drawAmPm(ctx);

    var minRot = (((fractionOfDay * 24) % 1) + 1) % 1 * 360;   // AS: ((arg*24)%1)*360
    var hourRot = (((fractionOfDay % 1) + 1) % 1) * 360;       // AS: arg*360
    drawHand(ctx, minRot, CLOCK.minLen, 4.5, "#6f6f6f");       // minute hand
    drawHand(ctx, hourRot, CLOCK.hourLen, 8, "#3a3a3a");       // hour hand
    // center pivot (gold), matching the original
    ctx.beginPath(); ctx.arc(CLOCK.cx, CLOCK.cy, 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#b08a00"; ctx.fill();
  }
  function drawHand(ctx, rotDeg, len, width, color) {
    ctx.save();
    ctx.translate(CLOCK.cx, CLOCK.cy);
    ctx.rotate(rotDeg * Math.PI / 180);   // rotation 0 = pointing up (12am / 0h)
    ctx.lineCap = "round";
    ctx.lineWidth = width; ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -len); ctx.stroke();
    ctx.restore();
  }
  function drawAmPm(ctx) {
    // Solar clock only (AS: siderealAnalogClock.showAmPmLabels = false).
    ctx.fillStyle = "#000000";
    ctx.font = "bold 13px Verdana, Arial, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    var r = 58;
    ctx.fillText("12 am", CLOCK.cx, CLOCK.cy - r);
    ctx.fillText("12 pm", CLOCK.cx, CLOCK.cy + r);
    ctx.fillText("6 am", CLOCK.cx + r + 4, CLOCK.cy);
    ctx.fillText("6 pm", CLOCK.cx - r - 4, CLOCK.cy);
  }

  // Earth position on the orbit, in canvas coords (AS OrbitView.setTime).
  function earthPos() {
    var daysSinceVE = tm.latestSolarDaysSinceLastVernalEquinox;
    var angle = (daysSinceVE / tm.tropicalYear) * (2 * Math.PI);
    var globeAngle = angle + ANGLE_AT_EQUINOX;
    return {
      x: ORBIT.cx + ORBIT.R * Math.cos(globeAngle),
      y: ORBIT.cy - ORBIT.R * Math.sin(globeAngle),     // AS: y = -R*sin(globeAngle)
      angle: angle
    };
  }
  function globeRotationDeg() {
    var daysSinceVE = tm.latestSolarDaysSinceLastVernalEquinox;
    var angle = (daysSinceVE / tm.tropicalYear) * (2 * Math.PI);
    var solar = tm.latestSolarTime;
    // AS: 180 - (solarTime%1)*360 - angle*(180/PI)
    return GLOBE_ROT_OFFSET - (((solar % 1) + 1) % 1) * 360 - angle * (180 / Math.PI);
  }

  function drawOrbit(canvas) {
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ORBIT.w, ORBIT.w);

    // orbit ring (code-drawn geometry)
    ctx.beginPath(); ctx.arc(ORBIT.cx, ORBIT.cy, ORBIT.R, 0, 2 * Math.PI);
    ctx.strokeStyle = "#8a8a8a"; ctx.lineWidth = 1; ctx.stroke();

    // Sun: code-drawn radial gradient (no exported file for it)
    var g = ctx.createRadialGradient(ORBIT.cx, ORBIT.cy, 2, ORBIT.cx, ORBIT.cy, 46);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, "#fff6c9");
    g.addColorStop(0.7, "#ffd24d"); g.addColorStop(1, "rgba(255,180,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ORBIT.cx, ORBIT.cy, 46, 0, 2 * Math.PI); ctx.fill();

    // Earth globe + standing figure (reused exported bitmaps), rotated as a group
    var e = earthPos();
    var rot = globeRotationDeg() * Math.PI / 180;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(rot);
    if (img.earth && img.earth.complete) {
      ctx.drawImage(img.earth, -ORBIT.globeR, -ORBIT.globeR, 2 * ORBIT.globeR, 2 * ORBIT.globeR);
    } else {
      ctx.beginPath(); ctx.arc(0, 0, ORBIT.globeR, 0, 2 * Math.PI);
      ctx.fillStyle = "#5a9a3a"; ctx.fill();
    }
    if (img.figure && img.figure.complete) {
      ctx.drawImage(img.figure, -ORBIT.figW / 2, -(ORBIT.globeR + ORBIT.figH), ORBIT.figW, ORBIT.figH);
    }
    ctx.restore();
  }

  // ---- formatting (matches AS number formatting; toFixed(3) on readouts) ----
  function fmt3(n) { return n.toFixed(3); }
  function solarTODLabel() {
    // 12-hour clock label for the current solar time of day
    var f = frac01(tm.latestSolarTime), h = f * 24;
    var hh = Math.floor(h + 1e-9), mm = Math.round((h - hh) * 60);
    if (mm === 60) { mm = 0; hh = (hh + 1) % 24; }
    var suffix = hh < 12 ? "am" : "pm";
    var h12 = hh % 12; if (h12 === 0) h12 = 12;
    var label = h12 + ":" + (mm < 10 ? "0" : "") + mm + " " + suffix;
    if (mm === 0 && hh === 0) label += " (midnight)";
    else if (mm === 0 && hh === 12) label += " (noon)";
    return label;
  }
  function siderealTODLabel() {
    var f = frac01(tm.latestSiderealTime), h = f * 24;
    var hh = Math.floor(h + 1e-9), mm = Math.round((h - hh) * 60);
    if (mm === 60) { mm = 0; hh = (hh + 1) % 24; }
    return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm + " sidereal";
  }

  // ---- Readouts: plain HTML text (NOT MathJax, by request). The Aries glyph
  //      uses U+FE0E (text presentation) so it draws as a symbol, not an emoji.
  //      The visible text is aria-hidden; the matching sr-only span carries the
  //      spoken prose (and is referenced by the sliders' aria-describedby).
  var ARIES = "♈︎";
  var lastSolarStr = "", lastSidStr = "";
  function syncReadouts() {
    var sd = fmt3(tm.latestSolarDaysSinceLastVernalEquinox);
    var rd = fmt3(tm.latestSiderealDaysSinceLastVernalEquinox);
    if (sd !== lastSolarStr) {
      lastSolarStr = sd;
      $("solar-days-eqn").textContent = "solar days since " + ARIES + " = " + sd;
      $("solar-days-sr").textContent = "Solar days since the vernal equinox: " + sd + ". Solar time of day " + solarTODLabel() + ".";
    }
    if (rd !== lastSidStr) {
      lastSidStr = rd;
      $("sidereal-days-eqn").textContent = "sidereal days since " + ARIES + " = " + rd;
      $("sidereal-days-sr").textContent = "Sidereal days since the vernal equinox: " + rd + ". Sidereal time of day " + siderealTODLabel() + ".";
    }
  }

  // ---- native control sync (sliders + button highlights) --------------------
  function setRange(range, value, step, valuetext) {
    var v = Math.round(value / step) * step;
    if (document.activeElement !== range) range.value = v;
    else range.value = v;
    range.setAttribute("aria-valuetext", valuetext);
  }
  function syncControls() {
    setRange(solarTimeRange, frac01(tm.latestSolarTime) * 24, 0.25, solarTODLabel());
    setRange(sidTimeRange, frac01(tm.latestSiderealTime) * 24, 0.25, siderealTODLabel());
    setRange(dayRange, tm.latestSolarDaysSinceLastVernalEquinox, 1,
      fmt3(tm.latestSolarDaysSinceLastVernalEquinox) + " days since the vernal equinox");

    setPressed("goto-midnight", tm.latestIsAtMidnight());
    setPressed("goto-sunrise", tm.latestIsAtSunrise());
    setPressed("goto-noon", tm.latestIsAtNoon());
    setPressed("goto-sunset", tm.latestIsAtSunset());
    setPressed("goto-0h", tm.latestIsAt0h());
    setPressed("goto-6h", tm.latestIsAt6h());
    setPressed("goto-12h", tm.latestIsAt12h());
    setPressed("goto-18h", tm.latestIsAt18h());
    setPressed("goto-ve", tm.latestIsAtVernalEquinox());
    setPressed("goto-ss", tm.latestIsAtSummerSolstice());
    setPressed("goto-ae", tm.latestIsAtAutumnalEquinox());
    setPressed("goto-ws", tm.latestIsAtWinterSolstice());
  }
  function setPressed(id, on) { var el = $(id); if (el) el.setAttribute("aria-pressed", on ? "true" : "false"); }

  // ---- canvas image descriptions (informative, for screen readers) ---------
  function syncCanvasDescriptions() {
    $("solar-clock-desc").textContent = "Solar clock reads " + solarTODLabel() + ".";
    $("sidereal-clock-desc").textContent = "Sidereal clock reads " + siderealTODLabel() + ".";
    $("orbit-desc").textContent =
      "Earth is " + fmt3(tm.latestSolarDaysSinceLastVernalEquinox) +
      " solar days past the vernal equinox; the standing figure shows local solar time " + solarTODLabel() + ".";
  }

  // ---- the single render(): canvas + DOM + readouts -------------------------
  function render() {
    if (solarCanvas) drawClock(solarCanvas, tm.latestSolarTime, true);
    if (sidCanvas) drawClock(sidCanvas, tm.latestSiderealTime, false);
    if (orbitCanvas) drawOrbit(orbitCanvas);
    syncReadouts();
    syncControls();
    syncCanvasDescriptions();
  }

  // ---- aria-live announcer (on commit, not per animation tick) -------------
  function announce() {
    var bits = ["Solar time " + solarTODLabel() + ".",
      "Sidereal time " + siderealTODLabel() + ".",
      fmt3(tm.latestSolarDaysSinceLastVernalEquinox) + " solar days since the vernal equinox."];
    if (tm.latestIsAtVernalEquinox()) bits.push("At the vernal equinox.");
    else if (tm.latestIsAtSummerSolstice()) bits.push("At the summer solstice.");
    else if (tm.latestIsAtAutumnalEquinox()) bits.push("At the autumnal equinox.");
    else if (tm.latestIsAtWinterSolstice()) bits.push("At the winter solstice.");
    $("sr-status").textContent = bits.join(" ");
  }

  // ---- responder interface (Main.as) ---------------------------------------
  tm.responder = {
    onTimeMasterModeChanged: function () { },
    onTimeMasterAnimationStart: function () { },
    onTimeMasterAnimationStop: function () { },
    onTimeMasterAnimationUpdate: function () { render(); },
    onTimeMasterTimeChanged: function () { render(); announce(); }
  };

  /* ==========================================================================
     POINTER DRAG -- one Pointer Events path for mouse + touch. Coordinates are
     mapped back through the canvas scale into the original internal coordinate
     system, so the AS drag/snap math operates exactly as in the Flash original.
     ========================================================================== */
  function canvasPoint(canvas, ev, logicalW) {
    var rect = canvas.getBoundingClientRect();
    var s = logicalW / rect.width;
    return { x: (ev.clientX - rect.left) * s, y: (ev.clientY - rect.top) * s };
  }
  function norm180(d) { d = (d % 360 + 360) % 360; if (d > 180) d -= 360; return d; }
  function normPI(a) { a = (a % (2 * Math.PI) + (2 * Math.PI)) % (2 * Math.PI); if (a > Math.PI) a -= 2 * Math.PI; return a; }

  // ----- ORBIT: drag the globe (changes day) or the figure (changes time) ----
  var orbitDrag = null;
  function orbitDown(ev) {
    var p = canvasPoint(orbitCanvas, ev, ORBIT.w);
    var mx = p.x - ORBIT.cx, my = p.y - ORBIT.cy;       // relative to orbit center (= AS origin)
    var e = earthPos();
    var gx = e.x - ORBIT.cx, gy = e.y - ORBIT.cy;       // Earth pos relative to center
    var rot = globeRotationDeg() * Math.PI / 180;
    // figure world position (group point (0,-(globeR+figH/2)) rotated by rot)
    var figMid = ORBIT.globeR + ORBIT.figH / 2;
    var fx = e.x + figMid * Math.sin(rot), fy = e.y - figMid * Math.cos(rot);
    var dFig = Math.hypot(p.x - fx, p.y - fy);
    var dGlobe = Math.hypot(p.x - e.x, p.y - e.y);

    tm.incrementLatestSolarTime(0, 0);   // AS: onDragged(0) stops any animation
    if (dFig <= 18) {
      // figure drag: AS onFigureMouseDown
      var off = Math.atan2(my - gy, mx - gx) * (180 / Math.PI) - globeRotationDeg();
      orbitDrag = { type: "figure", offset: off };
    } else if (dGlobe <= ORBIT.globeR + 8) {
      // globe drag: AS onGlobeMouseDown
      var off2 = Math.atan2(my, mx) - Math.atan2(gy, gx);
      orbitDrag = { type: "globe", offset: off2 };
    } else { orbitDrag = null; return; }
    orbitCanvas.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }
  function orbitMove(ev) {
    if (!orbitDrag) return;
    var p = canvasPoint(orbitCanvas, ev, ORBIT.w);
    var mx = p.x - ORBIT.cx, my = p.y - ORBIT.cy;
    var e = earthPos();
    var gx = e.x - ORBIT.cx, gy = e.y - ORBIT.cy;
    if (orbitDrag.type === "globe") {
      // AS onStageMouseMoveFuncForGlobe
      var angleDelta = -(Math.atan2(my, mx) - Math.atan2(gy, gx) - orbitDrag.offset);
      angleDelta = normPI(angleDelta);
      var timeDelta = angleDelta * tm.tropicalYear / (2 * Math.PI);
      if (ev.shiftKey) {
        timeDelta = timeDelta * tm.siderealPerSolar;
        timeDelta = Math.round(timeDelta);
        timeDelta = timeDelta / tm.siderealPerSolar;
      } else {
        timeDelta = Math.round(timeDelta);
      }
      tm.incrementLatestSolarTime(timeDelta, 0);
    } else {
      // AS onStageMouseMoveFuncForFigure
      var rotationDelta = -(Math.atan2(my - gy, mx - gx) * (180 / Math.PI) - globeRotationDeg() - orbitDrag.offset);
      rotationDelta = norm180(rotationDelta);
      tm.incrementLatestSolarTime(rotationDelta / 360, 0);
    }
    ev.preventDefault();
  }
  function orbitUp(ev) { orbitDrag = null; try { orbitCanvas.releasePointerCapture(ev.pointerId); } catch (e) { } }

  // ----- CLOCK: drag the hour or minute hand ---------------------------------
  // The drag picks whichever hand's tip is nearer the pointer, then reproduces
  // AnalogClockHand: offset = pointerAngle - rotation; delta normalized; the
  // handler converts degrees to a solar/sidereal time delta.
  function makeClockDrag(canvas, isSidereal) {
    var drag = null;
    function timeVal() { return isSidereal ? tm.latestSiderealTime : tm.latestSolarTime; }
    function handRot(which) {
      var f = frac01(timeVal());
      return which === "hour" ? f * 360 : (((f * 24) % 1) + 1) % 1 * 360;
    }
    function pointerAngle(mx, my) { return Math.atan2(my, mx) * (180 / Math.PI) + 90; }  // AS: +90
    function applyDelta(which, deltaDeg) {
      // AS: hour -> onHandsDragged(delta/360); minute -> onHandsDragged(delta/(360*24))
      var frac = which === "hour" ? deltaDeg / 360 : deltaDeg / (360 * 24);
      if (isSidereal) tm.incrementLatestSiderealTime(frac, 0);
      else tm.incrementLatestSolarTime(frac, 0);
    }
    function tip(which) {
      var r = handRot(which) * Math.PI / 180, len = which === "hour" ? CLOCK.hourLen : CLOCK.minLen;
      return { x: CLOCK.cx + len * Math.sin(r), y: CLOCK.cy - len * Math.cos(r) };
    }
    canvas.addEventListener("pointerdown", function (ev) {
      var p = canvasPoint(canvas, ev, CLOCK.w);
      var th = tip("hour"), tmn = tip("minute");
      var which = Math.hypot(p.x - th.x, p.y - th.y) <= Math.hypot(p.x - tmn.x, p.y - tmn.y) ? "hour" : "minute";
      var mx = p.x - CLOCK.cx, my = p.y - CLOCK.cy;
      applyDelta(which, 0);  // AS rotationChangeHandler(0): stops any animation
      drag = { which: which, offset: pointerAngle(mx, my) - handRot(which) };
      canvas.setPointerCapture(ev.pointerId); ev.preventDefault();
    });
    canvas.addEventListener("pointermove", function (ev) {
      if (!drag) return;
      var p = canvasPoint(canvas, ev, CLOCK.w);
      var mx = p.x - CLOCK.cx, my = p.y - CLOCK.cy;
      var delta = norm180(pointerAngle(mx, my) - handRot(drag.which) - drag.offset);
      applyDelta(drag.which, delta);
      ev.preventDefault();
    });
    function end(ev) { if (drag) { drag = null; announce(); try { canvas.releasePointerCapture(ev.pointerId); } catch (e) { } } }
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }

  /* ==========================================================================
     NATIVE CONTROLS -- sliders + buttons. Each slider is INCREMENTAL, exactly
     like the original drags (it adds a delta to the time), so keyboard and
     pointer paths mutate the same state and stay perfectly in sync.
     ========================================================================== */
  function wireSliders() {
    // Solar time-of-day: arrow keys nudge the solar clock, like dragging a hand.
    solarTimeRange.addEventListener("input", function () {
      var target = parseFloat(solarTimeRange.value);       // 0..24h
      var current = frac01(tm.latestSolarTime) * 24;
      var delta = target - current;
      tm.incrementLatestSolarTime(delta / 24, 0);
    });
    solarTimeRange.addEventListener("change", announce);

    // Sidereal time-of-day.
    sidTimeRange.addEventListener("input", function () {
      var target = parseFloat(sidTimeRange.value);
      var current = frac01(tm.latestSiderealTime) * 24;
      var delta = target - current;
      tm.incrementLatestSiderealTime(delta / 24, 0);
    });
    sidTimeRange.addEventListener("change", announce);

    // Day of year: arrow keys step the orbital day, like dragging the globe/thumb.
    dayRange.addEventListener("input", function () {
      var target = parseFloat(dayRange.value);              // 0..365 days since VE
      var current = tm.latestSolarDaysSinceLastVernalEquinox;
      var delta = target - current;
      tm.incrementLatestSolarTime(delta, 0);
    });
    dayRange.addEventListener("change", announce);
  }

  function wireButtons() {
    // advance-by (AS Main button handlers + animation durations)
    $("adv-solar-1").addEventListener("click", function () { tm.incrementSolarTime(1, dur(1000)); });
    $("adv-solar-10").addEventListener("click", function () { tm.incrementSolarTime(10, dur(2000)); });
    $("adv-sid-1").addEventListener("click", function () { tm.incrementSiderealTime(1, dur(1000)); });
    $("adv-sid-10").addEventListener("click", function () { tm.incrementSiderealTime(10, dur(2000)); });
    // go to time of day (solar)
    $("goto-midnight").addEventListener("click", function () { goToSolarTimeOfDay(0, dur(1000)); });
    $("goto-sunrise").addEventListener("click", function () { goToSolarTimeOfDay(0.25, dur(1000)); });
    $("goto-noon").addEventListener("click", function () { goToSolarTimeOfDay(0.5, dur(1000)); });
    $("goto-sunset").addEventListener("click", function () { goToSolarTimeOfDay(0.75, dur(1000)); });
    // go to sidereal time of day
    $("goto-0h").addEventListener("click", function () { goToSiderealTimeOfDay(0, dur(1000)); });
    $("goto-6h").addEventListener("click", function () { goToSiderealTimeOfDay(0.25, dur(1000)); });
    $("goto-12h").addEventListener("click", function () { goToSiderealTimeOfDay(0.5, dur(1000)); });
    $("goto-18h").addEventListener("click", function () { goToSiderealTimeOfDay(0.75, dur(1000)); });
    // go to season (fraction of year)
    $("goto-ve").addEventListener("click", function () { goToFractionOfYear(0, dur(2000)); });
    $("goto-ss").addEventListener("click", function () { goToFractionOfYear(0.25, dur(2000)); });
    $("goto-ae").addEventListener("click", function () { goToFractionOfYear(0.5, dur(2000)); });
    $("goto-ws").addEventListener("click", function () { goToFractionOfYear(0.75, dur(2000)); });
  }

  // ---- month tick labels on the day-of-year slider --------------------------
  function buildMonths() {
    var months = ["M", "A", "M", "J", "J", "A", "S", "O", "N", "D", "J", "F", "M"];
    var wrap = document.querySelector(".sim-dayslider__months");
    if (!wrap) return;
    wrap.innerHTML = months.map(function (m) { return "<span>" + m + "</span>"; }).join("");
  }

  // ---- typeset the static MathJax bits in buttons / labels ------------------
  function typesetStatic() {
    document.querySelectorAll("[data-tex]").forEach(function (el) {
      if (!el.getAttribute("data-typeset")) {
        el.textContent = "\\(" + el.getAttribute("data-tex") + "\\)";
        el.setAttribute("data-typeset", "1");
      }
    });
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch(function () { });
    }
  }

  // ---- reset (masthead "sim-reset" -> exact initial state) ------------------
  function resetSim() {
    tm.setMode(SIMPLE);   // AS Main.reset(): mode = SIMPLE -> setSolarTime(0.5)
    lastSolarStr = ""; lastSidStr = "";
    render(); announce();
  }

  /* ==========================================================================
     BOOT
     ========================================================================== */
  function boot() {
    solarCanvas = $("solar-canvas"); sidCanvas = $("sidereal-canvas"); orbitCanvas = $("orbit-canvas");
    solarTimeRange = $("solar-time-range"); sidTimeRange = $("sidereal-time-range"); dayRange = $("day-range");

    setupCanvasDPR(solarCanvas, CLOCK.w, CLOCK.w);
    setupCanvasDPR(sidCanvas, CLOCK.w, CLOCK.w);
    setupCanvasDPR(orbitCanvas, ORBIT.w, ORBIT.w);

    img.earth = loadImage("assets/earth.png");
    img.figure = loadImage("assets/figure.png");
    img.face = loadImage("assets/clock-face.png");

    buildMonths();
    typesetStatic();
    wireSliders();
    wireButtons();
    makeClockDrag(solarCanvas, false);
    makeClockDrag(sidCanvas, true);
    orbitCanvas.addEventListener("pointerdown", orbitDown);
    orbitCanvas.addEventListener("pointermove", orbitMove);
    orbitCanvas.addEventListener("pointerup", orbitUp);
    orbitCanvas.addEventListener("pointercancel", orbitUp);

    document.addEventListener("sim-reset", resetSim);
    // prefers-reduced-motion change: addEventListener is modern; addListener is the
    // legacy MediaQueryList API still needed by older Safari/WebKit.
    if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", render);
    else if (reduceMotion.addListener) reduceMotion.addListener(render);
    window.addEventListener("resize", function () {
      setupCanvasDPR(solarCanvas, CLOCK.w, CLOCK.w);
      setupCanvasDPR(sidCanvas, CLOCK.w, CLOCK.w);
      setupCanvasDPR(orbitCanvas, ORBIT.w, ORBIT.w);
      render();
    });

    // Redefine the foundation hook so equations init on load (then it is superseded).
    window.klunlInitEqn = function () { lastSolarStr = ""; lastSidStr = ""; syncReadouts(); };

    render();
    announce();
  }

  // Boot once MathJax startup is ready (so typesetting works); fall back anyway.
  function start() {
    if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
      window.MathJax.startup.promise.then(boot, boot);
    } else { boot(); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
