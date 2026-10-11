/* ============================================================================
   GROUNDWORK — GOOGLE APPS SCRIPT RECEIVER          v4, lean
   Extensions > Apps Script in your sheet, paste this over what is there,
   SAVE (the version is cut from the last save, not from what is on screen),
   then Deploy > Manage deployments > pencil > Version: New version > Deploy.

   WHAT THIS VERSION DROPS. v3 carried 53 columns for a page that no longer
   exists: pA..pE3 were the scroll's chapters, max_P and pause_cycles measured
   a zoom, opt_* measured a tab strip, and t500/t50/t5 measured three scales
   the reader walked through. All of that went when the film replaced the
   scroll. What is left is the three things worth knowing — where the time
   goes, who signs up, and who clicks the demo — in 26 columns.

   THE COLUMNS MOVED, so the first write parks the existing `events` tab as
   `events_old` and starts a clean one. Nothing is lost and nothing is
   mislabelled; the old rows stay readable under their own header.

     mailing list  = filter kind = "signup", read `email`
     sessions      = filter kind = "leave",  last row per sid + started

   Check which code is live by opening the /exec URL in a browser. Saving the
   script changes nothing until you redeploy.
   ========================================================================= */

var VERSION = 'v4 (lean: section time, signups, demo)';

var SHEET_NAME = 'events';

/* THE PAGE'S FIVE BLOCKS, IN THE ORDER A READER MEETS THEM. Listed once and
   used twice — for the column names and for reading the payload — so a block
   cannot have a column without a value or a value without a column. `other`
   catches anything not covered by a named block, which makes the per-section
   seconds sum exactly to active_s and turns a silent gap into a visible one.
   Add a block to the page, add its id here. */
var SECTIONS = ['hero', 'film', 'opening', 'scales', 'close', 'other'];

var HEAD = [].concat(
  /* who and what. email and source sit third and fourth because on the day you
     use this sheet you are looking for addresses, not for referrers. */
  ['received', 'sid', 'kind', 'email', 'source', 'started'],
  ['device', 'referrer'],
  ['total_s', 'active_s'],
  SECTIONS.map(function (k) { return k + '_s'; }),
  /* THE FILM IS THE PAGE NOW, and section time does not measure it. film_s is
     how long the block sat mid-screen; film_watched_s is how much of the
     sixty seconds actually played. A reader can hold the film on screen for a
     minute having watched four seconds of it. */
  ['film_watched_s', 'film_pct', 'film_loops', 'film_sound'],
  ['demo_header', 'demo_end', 'ml_opens', 'ml_submit'],
  ['errors', 'first_error']
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
  var s = d.sections || {}, c = d.clicks || {}, f = d.film || {};
  var o = {
    received: new Date(), sid: d.sid, kind: d.kind, started: d.started,
    device: d.device, referrer: d.ref,
    total_s: d.total, active_s: d.active,
    film_watched_s: f.watched || 0, film_pct: f.pct || 0,
    film_loops: f.loops || 0, film_sound: f.sound || 0,
    demo_header: c.demo_header || 0, demo_end: c.demo_end || 0,
    ml_opens: c.ml_opens || 0, ml_submit: c.ml_submit || 0,
    errors: d.errs || 0, first_error: d.firstErr || ''
  };
  SECTIONS.forEach(function (k) { o[k + '_s'] = s[k] || 0; });
  sh.appendRow(rowFrom(o));
  return out('ok');
}

/* THE ADDRESS IS THE ONLY THING HERE THAT CANNOT BE COLLECTED AGAIN, so it is
   validated and de-duplicated before anything is written. The dedupe reads one
   column of the whole tab — fine into the thousands of rows, and the first
   thing to revisit if this sheet ever gets big. */
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
  var f = d.film || {};
  sh.appendRow(rowFrom({
    received: new Date(), sid: d.sid, kind: 'signup',
    email: email, source: d.source || '',
    device: d.device, referrer: d.ref,
    /* how much of the film they had watched when they asked — the one thing a
       signup row can say that an address on its own cannot */
    film_watched_s: f.watched || 0, film_pct: f.pct || 0
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
     starts. Going from v3 to v4 moves them — expect `events_old`. */
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
