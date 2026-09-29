# Groundwork — scroll page

Static, one file. No build step, no dependencies, no npm.

```
index.html          the page, with tracking AND the endpoint already wired in
frames/             the three screenshots the page loads
apps-script/Code.gs the Google Sheets receiver — session events and signups
apps-script/tracking-snippet-standalone.js
                    the same tracking code on its own, if it ever needs to go
                    into a different page
```

---

## 1. Deploy to Vercel

1. Push this folder to a GitHub repo (`index.html` must be at the repo root).
2. Vercel → **Add New… → Project** → pick the repo.
3. Framework preset: **Other**. Build command: leave empty. Output directory: leave empty.
4. Deploy.

You get `your-project.vercel.app`. Pushing to `main` redeploys.

**One thing to decide before launch.** Vercel's Hobby plan is restricted to
non-commercial, personal use. A marketing page for a product, with a demo CTA
and (if you add one) a price, is commercial use. Pro is $20/user/month. Hobby
allows 200 projects and 100 deploys a day, so capacity is not the question —
the licence is.

If you want the page and the app on one domain, buy the domain in Vercel and
map `www` → this project, `app` → the demo project. Cheaper than it sounds and
it stops the demo link feeling like a hop to a different company.

---

## 2. Turn the tracking on

1. Make a Google Sheet. Note its URL.
2. **Extensions → Apps Script**, delete the stub, paste `apps-script/Code.gs`.
3. **Deploy → New deployment → Web app.** Execute as **Me**; who has access
   **Anyone**. Authorise it. Copy the `/exec` URL.
4. Open that URL in a browser — it should print **`ok — v2 (events + signups)`**.
   If it asks you to sign in, access is not set to Anyone. **If it prints a bare
   `ok`, or anything without `v2`, the deployment is still serving old code** —
   saving the script does not change what `/exec` answers with. See the box below.
5. In `index.html`, the **third line of the `<head>`** is
   `<meta name="gw-endpoint" content="…">`. **This build already carries a
   URL** — the one the page was built against. Only replace it if you are
   pointing the page at a different sheet.
6. Push. Load the page, scroll to the end, close the tab. Two rows should
   appear within a few seconds.

> ### Pasting `Code.gs` over a script that is already deployed
>
> **The edit does nothing until you redeploy**, and there are two menu items
> here that look alike and are not:
>
> - **Deploy → Manage deployments →** click the existing deployment **→ pencil
>   (Edit) → Version: New version → Deploy.** ✅ Same `/exec` URL, new code.
>   Nothing in `index.html` changes.
> - **Deploy → New deployment.** ❌ Makes a *second* deployment on a **different**
>   `/exec` URL, leaves the old one live, and means editing the meta tag in
>   `index.html` to match.
>
> Skip the redeploy and the page POSTs perfectly happily to code that has never
> heard of the rows it is sending. A signup then lands in `events` as a
> half-empty row with `kind: signup` and **no address**, because the old header
> has no `email` column — and the reader is still told they are on the list.
> Nothing anywhere looks broken. Check `/exec` in a browser: if it does not say
> `v2`, that is what is happening.

**It must be the `/exec` URL.** The `/dev` one shown in the editor is the head
deployment: it answers only to the signed-in owner of the script, so no visitor
beacon will ever land. `/exec` comes from **Deploy → New deployment → Web app**,
and its id is different from the `/dev` one — you cannot make it by swapping the
suffix. The page logs a console warning if it sees a `/dev` URL.

With the tag left empty the tracker does nothing at all: no beacons, no errors,
no console noise. So it is safe to deploy the page before the sheet exists.

The header row is created automatically on the first write.

---

## 3. What lands in the sheet

Two rows per session — `arrive` on load, `leave` when the tab is hidden or
closed — plus one row per demo click. **Dedupe by taking the last row per
`sid`**; someone who backgrounds the tab and comes back sends another `leave`,
and the later one is fuller. The `arrive` row is deliberately near-empty: it
exists so the denominator survives people who bounce in two seconds, which is
exactly the group a leave-only beacon loses.

| column | what it is |
|---|---|
| `sid` | throwaway per-session id, no personal data |
| `device`, `vw`, `vh`, `dpr`, `touch` | mobile or desktop, and the numbers behind it |
| `referrer`, `query` | where they came from, UTM tags |
| `reduced_motion`, `dark` | both change what they actually saw — filter on these |
| `total_s`, `active_s` | wall-clock, and time with the tab visible and someone present |
| `t500_s`, `t50_s`, `t5_s` | **seconds on each scale** |
| `pA_s … detail_s` | **seconds on each panel**, one column each |
| `max_P`, `max_scroll_pct` | how far they got |
| `pause_cycles` | samples that caught a panel mid self-read — a direct read on "stopped and read" rather than "scrolled past" |
| `demo_header`, `demo_end` | the two CTAs, counted separately: the header click is impatience, the end click is persuasion |
| `ml_open_header`, `ml_open_end`, `ml_open_badge`, `ml_open_badge_top` | which of the four mailing-list triggers was opened — the header link, the button at the close, and the two "early access · on request" badges |
| `ml_submit` | opens that became addresses. Opens minus this is the abandon, and it is the one number that says whether the ask is landing or just being noticed |
| `opt_*` | the recommendation tabs |
| `errors`, `first_error` | a broken page looks like a content problem in the funnel unless you log this |
| `sections_raw` | every section time as JSON, whatever the section names are |

Dwell is sampled on a **250 ms timer, not on scroll**. Someone who stops to
read fires no scroll events at all, and stopping to read is the thing you most
want to measure. The timer only counts while the tab is visible and gives up
after 30 s with no input, so a page left open on a second monitor doesn't
inflate every number.

Because exactly one section covers the middle of the screen at a time, the
per-section seconds **sum to `active_s`** rather than double-counting overlaps.

### The second tab: `signups`

The mailing-list dialog writes here, one row per address, and `Code.gs` creates
the tab on the first signup. A repeat address is answered `ok dup` and nothing
is written — the person is on the list, which is what they asked for, so the
page still tells them so.

| column | what it is |
|---|---|
| `email` | lower-cased and trimmed, validated both sides |
| `source` | which trigger opened the dialog: `header`, `end`, `badge`, `badge_top` |
| `sid` | **the same id as the events tab** — join on it |
| `max_scroll_pct`, `max_P`, `scale_on_screen` | how far they had read when they asked |

That join is the point of the tab. An address on its own tells you someone was
interested; the same address next to `max_P 3.7, the parcel` tells you they
asked **before** they had seen the 50 or the 5, which is a different signal
about what is doing the persuading.

Opening the dialog does **not** send a beacon of its own — the counts ride out
on the session's own `leave` row. Three opens and an abandon would otherwise
log as four sessions.

The page reads the endpoint from the same `<meta>` tag the tracking uses, so
there is no second URL to keep in step. **A copy of the page built without that
tag will say so in the dialog rather than showing a thank-you it cannot keep.**

---

## 4. Editing the 50 and the 5 — what to watch

Mostly nothing. Two things do matter.

**Adding or removing a chapter moves the 500 / 50 / 5 boundaries.** `P` is
normalised over the whole zoom, but `numeral()`'s thresholds (`seg(P,4.42,4.98)`
and `seg(P,7.20,7.62)`) are tuned to the ten chapters that exist today — three
at the 500, four at the 50, three at the 5. Add an eleventh and the rail
changes scale at the wrong chapter. You would also need to bump `N` (currently
`11`, one more than the chapter count) and extend `KEY`.

Every `seg(P, …)` window in the page is measured against where the sections
currently fall, so changing one section's height slides all of them. `build.py`
asserts the ones that matter; run it after any change to the zoom.

The tracking is **immune to this by construction** — it reads the word the rail
has already put on screen (`#rsec`) rather than recomputing the test. So the log
is wrong exactly when the rail is visibly wrong, never silently. Retune the page
and the tracking retunes itself.

**A new section needs a new column.** The tracker names sections by their `id`,
so give every `.chapters > section` one. New ids land in `sections_raw`
automatically, but they won't get a column of their own until you add them to
`HEAD` and the `appendRow` list in `Code.gs`.

Two smaller ones: only `.panel` sections produce `pause_cycles`, so a `.ch`
chapter contributes nothing there; and the `opt_*` columns are keyed to the
current `frontage` / `centre` / `spine` values in `ORG`.

---

## 5. Volume

`appendRow` takes about a second and Apps Script limits concurrency, which is
why `Code.gs` takes a lock. Fine for hundreds of sessions a day. If this starts
getting real traffic the sheet is the thing to replace, not the snippet — the
payload is plain JSON and will POST anywhere.

Vercel's own Web Analytics is free up to 50,000 events a month and gives you
pageviews and referrers from one script tag. Worth letting it do the basics so
the sheet only carries the custom scroll and interaction data.

---

## 6. Privacy

A random id in `sessionStorage`, no IP logging, no personal data, nothing that
survives the tab closing. That keeps you in easy territory under the PDPA, but
a one-line note in the footer costs nothing and is the honest thing to do.
