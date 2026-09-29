/* ============================================================================
   GROUNDWORK — SCROLL PAGE TRACKING
   Paste this at the very END of the page's existing script block, just above
   its closing tag. It has to be inside (or after) that block because it
   reads the page's own `P` and `seg` rather than recomputing them — the
   number logged and the numeral on screen then cannot disagree.

   Two rows per session: "arrive" on load, "leave" when the tab is hidden or
   closed. Dwell is sampled on a timer, NOT on scroll — a reader who stops to
   read fires no scroll events, and stopping to read is the thing you most
   want to measure.

   Before using: set ENDPOINT, and give the last chapter an id:
       <section class="ch right" id="detail">
   ========================================================================= */
(function () {
  /* THE ENDPOINT LIVES IN A <meta> TAG AT THE TOP OF THE PAGE, not down here.
     Hunting for one line near the bottom of a 158 KB file is a good way to
     paste it into the wrong place; the tag is the third line of the head. */
  var ENDPOINT = ((document.querySelector('meta[name="gw-endpoint"]') || {}).content || "").trim();
  if (ENDPOINT.indexOf("http") !== 0) return;          // not configured yet — do nothing
  if (/\/dev$/.test(ENDPOINT)) {                        // the head deployment, not a real one
    console.warn("[gw] endpoint ends in /dev — that URL only answers to the "
      + "signed-in script owner, so no visitor beacon will land. Use the /exec "
      + "URL from Deploy > New deployment > Web app.");
  }

  var TICK = 250;        // ms between samples
  var IDLE = 30000;      // stop counting after this long with no input

  // a throwaway id, session-scoped, no personal data in it
  var sid = (function () {
    try {
      var s = sessionStorage.getItem("gw_sid");
      if (!s) {
        s = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem("gw_sid", s);
      }
      return s;
    } catch (e) { return "x" + Date.now().toString(36); }
  })();
  /* the signup POST carries this too, so a row in the signups tab joins to the
     session that produced it — you can see how far someone had read when they
     asked, not just that they asked */
  window.GWSID = sid;

  /* EVERY BLOCK OF THE PAGE, not just the chapters. Tracking only the chapters
     left the hero, the opening, the scales and the close uncounted, so the
     per-section seconds quietly failed to add up to the active time. Anything
     not covered by a named block lands in "other", which makes the columns sum
     exactly and turns a silent gap into a visible one. */
  var secs = [];
  [[".hero", "hero"], ["#open", "opening"], ["#scales", "scales"],
   [".runlead", "runlead"], [".end", "close"]].forEach(function (t) {
    var e = document.querySelector(t[0]); if (e) secs.push([e, t[1]]);
  });
  [].slice.call(document.querySelectorAll(".chapters > section")).forEach(function (e) {
    secs.push([e, e.id || e.className.trim().replace(/\s+/g, "-") || "sec"]);
  });

  var ms = { total: 0, active: 0 };
  var scaleMs = { "500": 0, "50": 0, "5": 0 };
  var secMs = {};
  secs.forEach(function (x) { secMs[x[1]] = 0; });
  secMs.other = 0;

  var clicks = { demo_header: 0, demo_end: 0, opt_frontage: 0, opt_centre: 0, opt_spine: 0,
                 ml_open_header: 0, ml_open_end: 0, ml_open_badge: 0,
                 ml_open_badge_top: 0, ml_submit: 0 };

  /* THE MAILING LIST COUNTS RIDE ON THE SESSION ROW, not on send(). Opening the
     dialog is not leaving the page, so it must not fire a beacon of its own —
     three opens and an abandon would otherwise look like four sessions. The
     counts go out with "leave" like everything else. */
  window.MLCLICK = function (k) {
    var key = "ml_" + k;
    clicks[key] = (clicks[key] || 0) + 1;
  };
  var maxP = 0, maxScroll = 0, cycles = 0, errs = 0, firstErr = "";
  var last = performance.now(), lastAct = last, started = Date.now();
  var sentLeave = false;

  ["scroll", "pointerdown", "keydown", "wheel", "touchstart"].forEach(function (ev) {
    addEventListener(ev, function () { lastAct = performance.now(); }, { passive: true });
  });
  addEventListener("error", function (e) {
    errs++; if (!firstErr) firstErr = String(e.message || "").slice(0, 120);
  });

  /* THE SCALE THE READER IS ON — READ OFF THE RAIL, NOT RECOMPUTED.
     The obvious way is to repeat numeral()'s own test, seg(P,3.25,4.00) and
     seg(P,6.35,7.00). Don't: those thresholds are tuned to the seven chapters
     that exist today, so adding or removing one at the 50 silently moves the
     boundary and the log drifts away from the page. Reading the word the rail
     has already put on screen means retuning the page retunes the tracking,
     and there is only ever one answer to "which scale was the reader on". */
  var RSEC = document.getElementById("rsec");
  var RAIL = document.getElementById("rail");
  var SCALE_OF = { "the parcel": "500", "the block": "50", "the detail": "5" };
  function scaleNow() {
    var w = RSEC && RSEC.textContent.trim().toLowerCase();
    return SCALE_OF[w] || "500";
  }

  /* THE PANEL THE READER IS ON. Whichever section covers the middle of the
     screen — exactly one at a time, so the per-section times sum cleanly to
     the total rather than double-counting the overlaps. */
  function liveSection() {
    var mid = innerHeight / 2;
    for (var i = 0; i < secs.length; i++) {
      var r = secs[i][0].getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) return secs[i][1];
    }
    return "other";
  }

  setInterval(function () {
    var now = performance.now(), dt = now - last; last = now;
    ms.total += dt;
    if (document.visibilityState !== "visible") return;   // tab in the background
    if (now - lastAct > IDLE) return;                     // walked away
    ms.active += dt;
    /* only while the rail is up. Its text says "the parcel" from page load, so
       counting it unconditionally charged the hero and the opening to the 500 */
    if (RAIL && RAIL.classList.contains("on")) scaleMs[scaleNow()] += dt;
    var L = liveSection(); if (L) secMs[L] += dt;
    if (P > maxP) maxP = P;
    var d = (scrollY + innerHeight) / Math.max(1, document.body.scrollHeight);
    if (d > maxScroll) maxScroll = d;
    // the panel self-reading is a direct signal that someone stopped to read
    if (document.querySelector(".panel.cyc")) cycles++;
  }, TICK);

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a.try, a.cta");
    if (a) {
      clicks[a.classList.contains("cta") ? "demo_end" : "demo_header"]++;
      send("click");                       // they are leaving; send now
      return;
    }
    var b = e.target.closest && e.target.closest("#opts button");
    if (b && b.dataset.k) {
      var k = "opt_" + b.dataset.k;
      clicks[k] = (clicks[k] || 0) + 1;
    }
  }, true);

  var s = function (x) { return Math.round(x / 1000); };   // ms -> whole seconds

  function payload(kind) {
    var out = {
      kind: kind,
      sid: sid,
      started: new Date(started).toISOString(),
      device: innerWidth <= 760 ? "mobile" : "desktop",
      vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio || 1,
      touch: ("ontouchstart" in window) ? 1 : 0,
      ref: (document.referrer || "").slice(0, 200),
      query: (location.search || "").slice(0, 200),
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0,
      dark: matchMedia("(prefers-color-scheme: dark)").matches ? 1 : 0,
      total: s(ms.total), active: s(ms.active),
      t500: s(scaleMs["500"]), t50: s(scaleMs["50"]), t5: s(scaleMs["5"]),
      maxP: +maxP.toFixed(2),
      maxScroll: Math.round(maxScroll * 100),
      cycles: cycles,
      errs: errs, firstErr: firstErr,
      clicks: clicks,
      sections: {}
    };
    for (var k in secMs) out.sections[k] = s(secMs[k]);
    return JSON.stringify(out);
  }

  function send(kind) {
    var body = payload(kind);
    try {
      // text/plain keeps it a simple request — no CORS preflight, which an
      // Apps Script web app would not answer
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain;charset=UTF-8" }));
      } else {
        fetch(ENDPOINT, { method: "POST", body: body, keepalive: true, mode: "no-cors" });
      }
    } catch (e) { /* tracking must never break the page */ }
  }

  send("arrive");        // the denominator, kept even if they bounce in 2 s

  function leave() {
    if (sentLeave) return;
    sentLeave = true;
    send("leave");
  }
  addEventListener("pagehide", leave);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") leave();
    else sentLeave = false;     // they came back; allow an updated row later
  });
})();
