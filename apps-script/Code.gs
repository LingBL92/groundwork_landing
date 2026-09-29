/* ============================================================================
   GROUNDWORK — GOOGLE APPS SCRIPT RECEIVER          v3, one tab
   Extensions > Apps Script in your sheet, paste this over what is there,
   SAVE (the version is cut from the last save, not from what is on screen),
   then Deploy > Manage deployments > pencil > Version: New version > Deploy.

   ONE TAB. Sessions and signups both append to `events`, told apart by the
   `kind` column. A signup gets its own row rather than being written back into
   the session's row, because the beacons fire arrive -> signup -> leave: at
   signup time the only row for that visitor is the near-empty `arrive` one,
   and the rule for reading this sheet is "take the LAST row per sid", which
   would hand you the `leave` row with no address on it. Appending is also the
   only shape that cannot race the `leave` beacon.

     mailing list  = filter kind = "signup", read `email`
     sessions      = filter kind = "leave",  last row per sid

   Check which code is live by opening the /exec URL in a browser. Saving the
   script changes nothing until you redeploy, and a bare "ok" used to look the
   same either way — which is the easiest way there is to lose every signup
   while nothing appears to be broken.
   ========================================================================= */

var VERSION = 'v3 (one tab: sessions + signups)';

var SHEET_NAME = 'events';

/* THE PAGE'S OWN SECTION IDS, IN THE ORDER A READER MEETS THEM. Listed once
   and used twice — for the column names and for reading the payload — so a
   panel cannot have a column without a value or a value without a column.
   The old header predated four of these: pP, pE1, pE2 and pE3 had no column
   at all and only survived inside sections_raw, while a dead `detail_s` sat
   in the sheet from a chapter that no longer exists. pP is the longest dwell
   on the page, so that was not a small gap. Add a panel to the page, add its
   id here. */
var SECTIONS = ['hero', 'opening', 'scales', 'runlead',
                'pA', 'pB', 'pC', 'pP', 'pD', 'ways', 'arch', 'pE1', 'pE2', 'pE3',
                'close', 'other'];

var HEAD = [].concat(
  /* who and what. email and source sit third and fourth because on the day you
     use this sheet you are looking for addresses, not for dpr. */
  ['received', 'sid', 'kind', 'email', 'source', 'started'],
  ['device', 'vw', 'vh', 'dpr', 'touch'],
  ['referrer', 'query', 'reduced_motion', 'dark'],
  ['total_s', 'active_s', 't500_s', 't50_s', 't5_s'],
  SECTIONS.map(function (k) { return k + '_s'; }),
  ['max_P', 'max_scroll_pct', 'pause_cycles'],
  ['demo_header', 'demo_end', 'opt_frontage', 'opt_centre', 'opt_spine'],
  ['ml_open_header', 'ml_open_end', 'ml_open_badge', 'ml_open_badge_top', 'ml_submit'],
  ['errors', 'first_error', 'sections_raw']     // the blob goes last, it is wide
);

var EMAIL_COL = HEAD.indexOf('email') + 1;      // 1-based, for getRange

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return out('busy'); }
  try {
    var d = JSON.parse(e.postData.contents);
    var sh = sheet(SHEET_NAME, HEAD);
    return d.kind === 'signup' ? signup(sh, d) : beacon(sh, d);
  } catch (err) {
    return out('err ' + err);
  } finally {
    lock.releaseLock();
  }
}

/* EVERY ROW IS BUILT FROM AN OBJECT KEYED BY COLUMN NAME, never from a
   positional list. A positional list and a header are two orderings of the
   same thing that have to be kept in step by hand, and they will not be. */
function rowFrom(o) {
  var r = [];
  for (var i = 0; i < HEAD.length; i++) {
    var v = o[HEAD[i]];
    r.push(v === undefined || v === null ? '' : v);
  }
  return r;
}

function beacon(sh, d) {
  var s = d.sections || {}, c = d.clicks || {};
  var o = {
    received: new Date(), sid: d.sid, kind: d.kind, started: d.started,
    device: d.device, vw: d.vw, vh: d.vh, dpr: d.dpr, touch: d.touch,
    referrer: d.ref, query: d.query, reduced_motion: d.reduced, dark: d.dark,
    total_s: d.total, active_s: d.active,
    t500_s: d.t500, t50_s: d.t50, t5_s: d.t5,
    max_P: d.maxP, max_scroll_pct: d.maxScroll, pause_cycles: d.cycles,
    demo_header: c.demo_header || 0, demo_end: c.demo_end || 0,
    opt_frontage: c.opt_frontage || 0, opt_centre: c.opt_centre || 0,
    opt_spine: c.opt_spine || 0,
    ml_open_header: c.ml_open_header || 0, ml_open_end: c.ml_open_end || 0,
    ml_open_badge: c.ml_open_badge || 0, ml_open_badge_top: c.ml_open_badge_top || 0,
    ml_submit: c.ml_submit || 0,
    errors: d.errs || 0, first_error: d.firstErr || '',
    sections_raw: JSON.stringify(s)
  };
  SECTIONS.forEach(function (k) { o[k + '_s'] = s[k] || 0; });
  sh.appendRow(rowFrom(o));
  return out('ok');
}

/* THE ADDRESS IS THE ONLY THING HERE THAT CANNOT BE COLLECTED AGAIN, so it is
   validated and de-duplicated before anything is written. The dedupe reads one
   column of the whole tab, which is the price of keeping the list in with the
   sessions rather than in a tab of its own — one read, fine into the thousands
   of rows, and the thing to revisit first if this sheet ever gets big. */
function signup(sh, d) {
  var email = String(d.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return out('err bad address');

  var n = sh.getLastRow();
  if (n > 1) {
    var have = sh.getRange(2, EMAIL_COL, n - 1, 1).getValues();
    for (var i = 0; i < have.length; i++) {
      // already on the list, which is what they asked for: say ok, write nothing
      if (String(have[i][0]).trim().toLowerCase() === email) return out('ok dup');
    }
  }
  sh.appendRow(rowFrom({
    received: new Date(), sid: d.sid, kind: 'signup',
    email: email, source: d.source || '',
    device: d.device, referrer: d.ref, query: d.query,
    /* how far they had read when they asked — the one thing a signup row can
       say that an address on its own cannot */
    max_P: d.maxP, max_scroll_pct: d.maxScroll,
    sections_raw: d.scale || ''
  }));
  return out('ok');
}

// smoke-test the URL in a browser: it prints which version is DEPLOYED, which
// is not the same question as which version is saved in the editor
function doGet() { return out('ok — ' + VERSION); }

function sheet(name, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) return fresh(ss, name, head);
  if (sh.getLastRow() === 0) { sh.appendRow(head); sh.setFrozenRows(1); return sh; }

  var have = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  /* HAS THE HEADER GROWN, OR HAS IT MOVED? Growing is safe: new columns went on
     the end and every row already written still reads correctly, so the header
     is widened in place. MOVING is not: rewriting the header over rows written
     under a different order relabels every one of them, silently and
     irreversibly. So the old tab is parked under its own name and a clean one
     starts — no data lost, nothing mislabelled, nothing for you to remember. */
  var moved = false;
  for (var i = 0; i < have.length; i++) {
    if (String(have[i]) !== String(head[i] === undefined ? '' : head[i])) { moved = true; break; }
  }
  if (moved) {
    sh.setName(freeName(ss, name + '_old'));
    return fresh(ss, name, head);
  }
  if (have.length < head.length) {
    sh.getRange(1, 1, 1, head.length).setValues([head]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function fresh(ss, name, head) {
  var sh = ss.insertSheet(name);
  sh.appendRow(head);
  sh.setFrozenRows(1);
  return sh;
}

function freeName(ss, base) {
  if (!ss.getSheetByName(base)) return base;
  for (var i = 2; i < 100; i++) if (!ss.getSheetByName(base + i)) return base + i;
  return base + Date.now();
}

function out(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}
