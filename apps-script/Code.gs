/* ============================================================================
   GROUNDWORK — GOOGLE APPS SCRIPT RECEIVER
   Extensions > Apps Script in your sheet, paste this, then
   Deploy > New deployment > Web app
     Execute as : Me
     Who has access : Anyone
   Copy the /exec URL into ENDPOINT in tracking-snippet.js.

   One row per beacon. Two beacons per session ("arrive", "leave"), plus one
   per demo click. Dedupe in the sheet by taking the LAST row per sid — a
   reader who backgrounds the tab and returns will send more than one "leave".
   ========================================================================= */

var SHEET_NAME = 'events';

var HEAD = [
  'received', 'sid', 'kind', 'started',
  'device', 'vw', 'vh', 'dpr', 'touch',
  'referrer', 'query', 'reduced_motion', 'dark',
  'total_s', 'active_s',
  't500_s', 't50_s', 't5_s',
  'pA_s', 'pB_s', 'pC_s', 'ways_s', 'arch_s', 'pD_s', 'detail_s',
  'max_P', 'max_scroll_pct', 'pause_cycles',
  'demo_header', 'demo_end', 'opt_frontage', 'opt_centre', 'opt_spine',
  'errors', 'first_error',
  'sections_raw'      // every section time as JSON — nothing is lost if you add one
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return out('busy'); }
  try {
    var d = JSON.parse(e.postData.contents);
    var sh = sheet();
    var s = d.sections || {}, c = d.clicks || {};
    sh.appendRow([
      new Date(), d.sid, d.kind, d.started,
      d.device, d.vw, d.vh, d.dpr, d.touch,
      d.ref, d.query, d.reduced, d.dark,
      d.total, d.active,
      d.t500, d.t50, d.t5,
      s.pA || 0, s.pB || 0, s.pC || 0, s.ways || 0, s.arch || 0, s.pD || 0,
      s.detail || s['ch-right'] || 0,
      d.maxP, d.maxScroll, d.cycles,
      c.demo_header || 0, c.demo_end || 0,
      c.opt_frontage || 0, c.opt_centre || 0, c.opt_spine || 0,
      d.errs || 0, d.firstErr || '',
      JSON.stringify(s)
    ]);
    return out('ok');
  } catch (err) {
    return out('err ' + err);
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return out('ok'); }   // lets you smoke-test the URL in a browser

function sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

function out(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}
