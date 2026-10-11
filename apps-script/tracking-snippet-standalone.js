/* ============================================================================
   GROUNDWORK — PAGE TRACKING                        v4, lean
   Paste this at the very END of the page's existing script block, just above
   its closing tag. build.py does that injection; this file is the source.

   THREE THINGS, AND NOTHING ELSE: where the time goes, who signs up, who
   clicks the demo. v3 carried the scroll's chapter timers, the zoom's
   progress, the tab strip's counters and a viewport fingerprint. The page
   those measured no longer exists.

   Two rows per session: "arrive" on load, "leave" when the tab is hidden or
   closed. Dwell is sampled on a timer, NOT on scroll — a reader who stops to
   read fires no scroll events, and stopping to read is the thing you most
   want to measure.
   ========================================================================= */
(function () {
  /* THE ENDPOINT LIVES IN A <meta> TAG AT THE TOP OF THE PAGE, not down here.
     Hunting for one line near the bottom of a 120 KB file is a good way to
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
  /* the signup POST carries this too, so a signup row joins to the session
     that produced it — you can see how much of the film someone had watched
     when they asked, not just that they asked */
  window.GWSID = sid;

  /* THE PAGE'S FIVE BLOCKS. Anything not covered by one lands in "other",
     which makes the columns sum exactly to active_s and turns a silent gap
     into a visible one. Keep this list and SECTIONS in Code.gs in step. */
  var secs = [];
  [[".hero", "hero"], [".film", "film"], ["#open", "opening"],
   ["#scales", "scales"], [".end", "close"]].forEach(function (t) {
    var e = document.querySelector(t[0]); if (e) secs.push([e, t[1]]);
  });

  var ms = { total: 0, active: 0 };
  var secMs = {};
  secs.forEach(function (x) { secMs[x[1]] = 0; });
  secMs.other = 0;

  var clicks = { demo_header: 0, demo_end: 0, ml_opens: 0, ml_submit: 0 };

  /* THE MAILING LIST COUNTS RIDE ON THE SESSION ROW, not on a send of their
     own. Opening the dialog is not leaving the page, so it must not fire a
     beacon — three opens and an abandon would otherwise look like four
     sessions. One `ml_opens` rather than one column per trigger: opens minus
     submits is the abandon, and which of the three buttons was pressed has
     never once changed a decision. `source` on the signup row still says. */
  window.MLCLICK = function (k) {
    /* THE PAGE CALLS THIS TWICE WITH DIFFERENT MEANINGS: "open_header" and
       friends when the dialog opens, "submit" when an address lands. Reading
       the argument is not optional — ignore it and every signup is also
       counted as an open, which makes the abandon rate read as zero. */
    if (k === "submit") clicks.ml_submit++;
    else clicks.ml_opens++;
  };

  var errs = 0, firstErr = "";
  var last = performance.now(), lastAct = last, started = Date.now();
  var sentLeave = false;

  ["scroll", "pointerdown", "keydown", "wheel", "touchstart"].forEach(function (ev) {
    addEventListener(ev, function () { lastAct = performance.now(); }, { passive: true });
  });
  addEventListener("error", function (e) {
    errs++; if (!firstErr) firstErr = String(e.message || "").slice(0, 120);
  });

  /* HOW MUCH OF THE FILM ACTUALLY PLAYED. Section time says the block was on
     screen; this says the film ran. They are different numbers and only this
     one answers "is the film landing" — a reader can hold it on screen for a
     minute having watched four seconds. High-water mark, not current time,
     so a scrub backwards does not lose what they already saw. */
  var FILM = document.getElementById("film");
  var film = { watched: 0, loops: 0, sound: 0 };
  /* the signup form, which lives in the page's own script and not in here,
     reads the high-water mark off this so its row can say how much of the
     film the reader had seen when they asked */
  window.GWFILM = film;
  if (FILM) {
    FILM.addEventListener("timeupdate", function () {
      if (FILM.currentTime > film.watched) film.watched = FILM.currentTime;
    });
    FILM.addEventListener("ended", function () { film.loops++; });
    FILM.addEventListener("volumechange", function () {
      if (!FILM.muted && FILM.volume > 0) film.sound = 1;
    });
  }

  /* THE BLOCK THE READER IS ON. Whichever covers the middle of the screen —
     exactly one at a time, so the per-section times sum cleanly to the total
     rather than double-counting the overlaps. */
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
    var L = liveSection(); if (L) secMs[L] += dt;
  }, TICK);

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a.try, a.cta");
    if (a) {
      clicks[a.classList.contains("cta") ? "demo_end" : "demo_header"]++;
      send("click");                       // they are leaving; send now
    }
  }, true);

  var s = function (x) { return Math.round(x / 1000); };   // ms -> whole seconds

  function payload(kind) {
    var out = {
      kind: kind,
      sid: sid,
      started: new Date(started).toISOString(),
      device: innerWidth <= 760 ? "mobile" : "desktop",
      ref: (document.referrer || "").slice(0, 200),
      total: s(ms.total), active: s(ms.active),
      film: {
        watched: Math.round(film.watched),
        pct: (FILM && FILM.duration) ? Math.round(100 * film.watched / FILM.duration) : 0,
        loops: film.loops, sound: film.sound
      },
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
