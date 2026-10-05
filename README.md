# Groundwork — scroll page

Static, one file. No build step, no dependencies, no npm.

```
index.html          THE PAGE: intro, the 52-second film, the three scales,
                    the close. Tracking and the endpoint already wired in.
index_old.html      THE ARCHIVE: the scrolling version the film replaced, whole
                    and still working. Rename it over index.html to go back.
media/              the film and its poster (2.5 MB)
frames/             the three screenshots index_old.html loads
apps-script/Code.gs the Google Sheets receiver — session events and signups
apps-script/tracking-snippet-standalone.js
                    the same tracking code on its own, if it ever needs to go
                    into a different page
```

---

## 0. Two pages

The page is the film now. `index.html` is hero → **52 seconds** → opening →
three scales → close, about 7,900 px and 116 KB. `index_old.html` is the
scrolling version it replaced — the 500, the 50 and the 5 at 20,000 px — kept
whole rather than deleted, with every build guard it ever had. Its builder is
`build_full.py`.

**The film sits inside the dark field, between the hero and the opening**, and
it is there for a reason worth keeping. The opening's five beats — surfaces the
trade-offs, names the conflicts, checks what holds up — are the film said in the
abstract, and they were built as a ramp into the 500-to-5 scroll that paid them
off. That scroll is gone and the film is the payoff now, so running the beats
first spent five screens describing something the reader could have watched.
Moving it took the film from **75% of page depth to 13%**, one scroll below the
fold. `.dk` redefines the theme tokens on itself, so the section inherits the
dark field and needs no styling of its own. Two things are keyed to this: the
header's light/dark switch reads `#scales` (the first thing printed on paper —
key it to `.film` and the header goes light while standing on black), and the
build asserts hero &lt; film &lt; opening &lt; dkfade.

**What the film does not carry: the 5.** Its last beats are "500 LIVE" and
"50 EARLY ACCESS"; there is no detail chapter in it, so the exploded window and
the supplier comparison live only in the archive. The close still names the 5 as
in development, which is true, but nothing on the live page shows it.

The per-panel analytics go quiet with the scroll: `pA_s … pE3_s`, `max_P`,
`pause_cycles`, `t500/t50/t5` and the `opt_*` columns all measured chapters that
no longer exist. Sessions and the mailing list are unaffected.

> **The film has no column of its own, and it is now the page.** The tracker
> names blocks from a list — `.hero`, `#open`, `#scales`, `.end` — and `.film`
> is not on it, so its dwell falls into `other_s`. That is readable (on this
> page `other_s` is very nearly film time) but it is implicit, and it is not the
> number actually worth having, which is **how much of the 52 seconds people
> watch** — `currentTime` high-water, completed loops, and whether they pressed
> the sound. Those are four columns and a few lines in the snippet. Ask and I
> will wire them; it needs one redeploy of `Code.gs`, and because the new
> columns go on the end the header widens in place and no existing row moves.

### The film starts itself

Muted, when it reaches the screen, and it stops again when it leaves.

**Muted is not a preference, it is the price of admission.** No browser starts
audio without a gesture first, and one that is asked to does not ask the reader
— it refuses the `play()` and leaves a still frame that reads as a broken film.
So the film opens silent, the pill at its top right is the gesture, and the pill
only appears once the film is actually running, because "sound off" over a
poster is a puzzle rather than an offer. What silence costs is a music bed;
nothing is spoken over it, so the argument arrives either way.

**It costs nothing until someone scrolls.** `preload="none"` in the markup,
raised to `auto` by an observer a screen out — and that observer is itself armed
by the first scroll event. The gate matters now that the film is one screen
below the fold: the observer's margin covers it the moment the page loads, so
without the gate every visit that bounced without touching anything would pull
2.5 MB of a film nobody watched. Measured: **landed and never scrolled, 0 bytes;
one 40 px scroll, fully buffered.** There is no `autoplay` attribute either —
that fires on load, and the film would be running to nobody while the hero is
still on screen.

**It does not start at all** under `prefers-reduced-motion`, on a Save-Data
connection, or on 2G — and on those it does not preload either. The poster and
the controls are then the whole of it, which is where this page started.

Two things to know if you touch this. The observer callback carries *every*
crossing since the last one, oldest first, so it reads the **last** entry —
reading the first answers "where was it?" and leaves a phone sitting paused on a
fully visible film. And raising `preload` is the whole instruction: a `load()`
beside it tears the element down and fires a `pause` at nought seconds, which
the reader-took-over test would then believe. Both of those passed every static
check and failed only on a real scroll.

**It loops on a held last frame.** Not the `loop` attribute: that cuts from the
last frame to the first with no gap, so the card the whole film is built
towards — 500 LIVE, 50 EARLY ACCESS — never gets read. Instead `ended` starts a
one-second timer and the timer rewinds it, which means everything that can
happen during that second is handled: scrolled away (checked at fire time, and
it restarts on return instead), taken over by the reader, or pressed manually —
each cancels the beat, and a restart cancels any beat still pending so a quick
scroll out and back cannot land two rewinds a few frames apart. Measured at
1002 ms and 1001 ms over two cycles.

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
4. Open that URL in a browser — it should print **`ok — v3 (one tab: sessions + signups)`**.
   If it asks you to sign in, access is not set to Anyone. **If it prints a bare
   `ok`, or anything without `v3`, the deployment is still serving old code** —
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
> `v3`, that is what is happening.

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

**v4 is lean.** Three questions — where does the time go, who signs up, who
clicks the demo — in **26 columns**, down from 53. What went: `pA`..`pE3` were
the scroll's chapters, `max_P` and `pause_cycles` measured a zoom, `opt_*`
measured a tab strip, `t500/t50/t5` measured three scales the reader walked
through, and `sections_raw` duplicated columns that now all exist. Every one of
those measured a page that no longer exists.

Two rows per session — `arrive` on load, `leave` when the tab is hidden or
closed — plus one row per demo click and one per signup. **Dedupe by taking the
last row per `sid` + `started`**; someone who backgrounds the tab and comes
back sends another `leave`, and the later one is fuller.

| column | what it is |
|---|---|
| `received` | when the row landed |
| `sid` | throwaway per-session id, no personal data — **and the join between a signup row and the session that produced it** |
| `kind` | `arrive`, `leave`, a demo click, or `signup` |
| `email`, `source` | filled only on a `signup` row. `source` is which trigger opened the dialog: `header`, `badge_top`, `end`. Third and fourth columns, because on the day you use this sheet you are looking for addresses |
| `started` | when the session began, ISO |
| `device` | `mobile` or `desktop`. Keep this one: phone and desktop dwell differ so much that an un-split average means nothing |
| `referrer` | where they came from |
| `total_s`, `active_s` | wall-clock, and time with the tab visible and someone present |
| `hero_s`, `film_s`, `opening_s`, `scales_s`, `close_s`, `other_s` | **seconds on each block.** The list lives in `SECTIONS` at the top of `Code.gs` and in the snippet's own list — keep them in step. Exactly one block covers the middle of the screen at a time, so these **sum to `active_s`** rather than double-counting overlaps. `other` catches anything unnamed, which turns a silent gap into a visible one |
| `film_watched_s`, `film_pct` | **how much of the 60 seconds actually played.** Not the same as `film_s`: that is how long the block sat on screen, and a reader can hold the film in view for a minute having watched four seconds of it. High-water mark, so scrubbing back does not lose what they already saw. This is the number that says whether the film lands |
| `film_loops` | completed plays. Anything above 1 means they watched it twice |
| `film_sound` | 1 if they pressed the sound pill. The film opens muted by necessity, so this is the only measure of whether anyone wants the audio |
| `demo_header`, `demo_end` | the two CTAs, counted separately: the header click is impatience, the end click is persuasion |
| `ml_opens`, `ml_submit` | dialog opened, and addresses given. **Opens minus submits is the abandon**, and it is the one number that says whether the ask is landing or just being noticed. One `ml_opens` rather than one column per trigger — which of the three buttons was pressed has never changed a decision, and `source` on the signup row still says |
| `errors`, `first_error` | kept against the lean brief on purpose: a broken page looks exactly like a content problem in the funnel unless you log this. Two columns, almost always empty |

Dwell is sampled on a **250 ms timer, not on scroll**. Someone who stops to
read fires no scroll events at all, and stopping to read is the thing you most
want to measure. The timer only counts while the tab is visible and gives up
after 30 s with no input, so a page left open on a second monitor doesn't
inflate every number.

### Signups live in the same tab

One tab, two kinds of row, told apart by `kind`:

```
mailing list  = filter kind = "signup", read `email`
sessions      = filter kind = "leave",  last row per sid + started
```

A signup **appends its own row** rather than being written into the session's
row. That is not a style choice: the beacons fire `arrive` → `signup` → `leave`,
so at signup time the only row for that visitor is the near-empty `arrive` one.
Writing the address there and then reading the sheet by the documented rule —
last row per `sid` — hands you the `leave` row with no address on it.

A repeat address is answered `ok dup` and nothing is written; the person is on
the list, which is what they asked for, so the page still tells them so.

The signup row carries `film_watched_s` and `film_pct`, so an address joins to
how much of the film the reader had seen when they asked. An address on its own
says someone was interested; the same address next to `film_pct 85` says the
film did it.

### Going from v3 to v4 parks the old tab

`Code.gs` compares the existing header with its own. The columns have **moved**,
not merely grown, so rewriting the header in place would relabel every row
already written. Instead the old tab is renamed `events_old` and a clean
`events` starts. Nothing is lost, nothing is mislabelled, and there is nothing
for you to remember to do.

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
