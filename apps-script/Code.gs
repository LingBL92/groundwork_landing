/* ============================================================================
   GROUNDWORK — GOOGLE APPS SCRIPT RECEIVER
   Extensions > Apps Script in your sheet, paste this over what is there, then
   Deploy > Manage deployments > (pencil) > Version: New version > Deploy.

   THAT REDEPLOY IS THE STEP THAT GETS MISSED. Saving the script changes
   nothing: the /exec URL keeps serving the version that was deployed, so the
   signups would post successfully to code that has never heard of them. The
   URL does not change when you redeploy, so nothing on the page needs editing.

   TWO TABS NOW.
     events  — one row per beacon, as before. Two per session ("arrive",
               "leave") plus one per demo click. Dedupe by taking the LAST row
               per sid: a reader who backgrounds the tab and returns sends more
               than one "leave".
     signups — one row per address, from the mailing-list dialog. Never more
               than one row for the same address; a repeat is answered "ok dup"
               so the page still tells them they are on the list, which is true.

   The two tabs join on sid, so a signup row carries how far that person had
   read when they asked — which is the thing an address on its own cannot say.
   ========================================================================= */

var SHEET_NAME  = 'events';
var SIGNUP_NAME = 'signups';

var HEAD = [
  'received', 'sid', 'kind', 'started',
  'device', 'vw', 'vh', 'dpr', 'touch',
  'referrer', 'query', 'reduced_motion', 'dark',
  'total_s', 'active_s',
  't500_s', 't50_s', 't5_s',
  'hero_s', 'opening_s', 'scales_s', 'runlead_s',
  'pA_s', 'pB_s', 'pC_s', 'ways_s', 'arch_s', 'pD_s', 'detail_s',
  'close_s', 'other_s',
  'max_P', 'max_scroll_pct', 'pause_cycles',
  'demo_header', 'demo_end', 'opt_frontage', 'opt_centre', 'opt_spine',
  'errors', 'first_error',
  'sections_raw',     // every section time as JSON — nothing is lost if you add one
  /* NEW COLUMNS GO ON THE END, NEVER IN THE MIDDLE. Your events tab already has
     rows under the old header; inserting the mailing-list counters next to the
     demo clicks would have slid 'errors' and everything after it one place
     right, and every row already written would have been read under the wrong
     heading from then on. */
  'ml_open_header', 'ml_open_end', 'ml_open_badge', 'ml_open_badge_top', 'ml_submit'
];

var SIGNUP_HEAD = [
  'received', 'email', 'source', 'sid',
  'device', 'referrer', 'query',
  'max_scroll_pct', 'max_P', 'scale_on_screen'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return out('busy'); }
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.kind === 'signup') return signup(d);      // its own tab, its own shape
    var sh = sheet(SHEET_NAME, HEAD);
    var s = d.sections || {}, c = d.clicks || {};
    sh.appendRow([
      new Date(), d.sid, d.kind, d.started,
      d.device, d.vw, d.vh, d.dpr, d.touch,
      d.ref, d.query, d.reduced, d.dark,
      d.total, d.active,
      d.t500, d.t50, d.t5,
      s.hero || 0, s.opening || 0, s.scales || 0, s.runlead || 0,
      s.pA || 0, s.pB || 0, s.pC || 0, s.ways || 0, s.arch || 0, s.pD || 0,
      s.detail || s['ch-right'] || 0,
      s.close || 0, s.other || 0,
      d.maxP, d.maxScroll, d.cycles,
      c.demo_header || 0, c.demo_end || 0,
      c.opt_frontage || 0, c.opt_centre || 0, c.opt_spine || 0,
      d.errs || 0, d.firstErr || '',
      JSON.stringify(s),
      c.ml_open_header || 0, c.ml_open_end || 0, c.ml_open_badge || 0,
      c.ml_open_badge_top || 0, c.ml_submit || 0
    ]);
    return out('ok');
  } catch (err) {
    return out('err ' + err);
  } finally {
    lock.releaseLock();
  }
}

/* THE ADDRESS IS THE ONLY THING HERE THAT CANNOT BE COLLECTED AGAIN. Everything
   else on the row is context; the email is the reason the row exists, so it is
   validated and de-duplicated before anything is written. */
function signup(d) {
  var email = String(d.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return out('err bad address');

  var sh = sheet(SIGNUP_NAME, SIGNUP_HEAD);
  var n = sh.getLastRow();
  if (n > 1) {
    var have = sh.getRange(2, 2, n - 1, 1).getValues();
    for (var i = 0; i < have.length; i++) {
      // already on the list, which is what they asked for — say ok, write nothing
      if (String(have[i][0]).trim().toLowerCase() === email) return out('ok dup');
    }
  }
  sh.appendRow([
    new Date(), email, d.source || '', d.sid || '',
    d.device || '', d.ref || '', d.query || '',
    d.maxScroll, d.maxP, d.scale || ''
  ]);
  return out('ok');
}

function doGet() { return out('ok'); }   // lets you smoke-test the URL in a browser

function sheet(name, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(head);
    sh.setFrozenRows(1);
    return sh;
  }
  /* and an existing tab gets the new headings written in, so the five
     mailing-list columns are not five unnamed ones at the end of the sheet.
     Safe only because new columns are appended, never inserted. */
  if (sh.getLastColumn() < head.length) {
    sh.getRange(1, 1, 1, head.length).setValues([head]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function out(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}
