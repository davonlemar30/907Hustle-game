# Alpha v0.7 Sixth Playtest Audit

Audit date: 2026-08-03 (America/Anchorage)

Baseline: merged `main` commit `0e07a00` (PR #46), save schema/key v3 / `907ogr_v3`.

Scope: story structure, event writing, player identity, and early-run direction.
This is the first of two builds; the Eli/Dre/Curtis/Goodie chains, the Goodie
dealer-robbery prototype, and the EndModal narrative recap are deferred to
v0.7.1.

---

## Pre-implementation audit

### The active runtime is smaller than the repository suggests

`index.html` loads only `v05.css`, `game-core.js`, and `ui.jsx`. The files
`events.js`, `script.js`, `style.css`, `combat.js`, and the `907hustle/`
directory are **not loaded**. The 42 events in `events.js` are dead content and
were mistaken for the live event set.

The real inventory was **16 event factories** in `activeEvent()` plus **4
encounter templates** in `startEncounter()` — 20 beats. `README.md` now names the
legacy files. They were not deleted this pass.

### Every run told the same story in the same order

`scheduleStory` (game-core.js:768–796 at baseline) was a single linear `if/else`
ladder. The first eligible branch won, every time, for every seed. Measured
before the change: **one distinct opening sequence across 30 seeds.**

### Mina had a beginning and an ending but no middle

Three pieces of content total: `mara_intro`, `mara_truth`, and the `early_mara`
encounter. Worse, the encounter fired on **Day 2**, putting her in danger before
the player had any context with her — the opposite of the intended order. She had
an unused `outcomes[]` array and no representation on the ClickUp Characters page
despite being the story spine.

### Title artwork: a CSS defect, not an art defect

`assets/907hustle-title.png` is **941×1672** (aspect 0.563). `.title-art` was
`position:fixed; inset:0; width:100%; height:100%; object-fit:cover;
object-position:center top` (v05.css:13).

At 1440×900, `cover` scales the image to width 1440, producing a rendered height
of **2558px** against a 900px viewport — **roughly 65% of the composition
discarded**, cropped entirely from the bottom. The mobile presentation was
correct and had to stay untouched.

No replacement asset was required.

---

## Implemented

1. **Three title tiers.** Portrait (<3/4) unchanged, byte for byte. 3/4–1/1
   keeps `cover` but recenters to `center 30%` so the crop takes from both ends.
   Above 1/1 switches to `contain` over a blurred self-backdrop (no black bars)
   with the controls in a right-anchored 420px column over a scrim.
2. **Optional Street Name.** 16 characters, sanitized to `[A-Za-z0-9 '-.]`,
   edge-derived default when skipped (`Steady` / `Silver` / `Quiet`). Appears in
   exactly six places. No profanity blocklist — see "Decisions" below.
3. **Event registry.** 30 declarative descriptors replacing the ladder, with a
   three-tier weighted selector, per-event cooldowns via `run.eventHistory`, an
   anti-monopoly rule, and a per-day story cap.
4. **Mina's six-stage arc**, including what she wants independent of the player
   (the Ship Creek dispatch job) and three distinct Day 7 outcomes.
5. **The Day 2 threat is now always `early_street`.** Her sedan encounter moved
   to stage 5, Day 5+.
6. **Nine one-off street events**, five of which involve no criminal transaction.
7. **All 14 inherited events rewritten** after the copy audit failed all of them.
8. **Terminology pass**, headlined by End Market → Finish Trading.

---

## Terminology: before and after

| Before | After | Why |
|---|---|---|
| `End Market` | `Finish Trading` | "End Market" named a system. The player is finishing an activity. |
| "Advance to the next part of day" | "Close this market visit · advance to {next part}" | The destination is now computed and named — Afternoon, Evening, Night, or "Day 4, Morning". |
| Travel hint: "Close the first market" | "Finish trading once to unlock" | Names the action, not a condition. |
| "trade freely, then close the visit to use one part of day" | "buy and sell freely; finishing the visit uses one part of day" | Removes the ambiguous "close". |
| `{enemyName} resolve` | "Their resolve" | The interpolation read as a label bug. |
| "Operation score" | "Operation Score" | It is a proper noun and the run's final rating. |
| travel/operations hint: "Close your first market period to unlock X" | "Finish trading once to unlock X" | Matches the button it refers to. |
| people hint: "Meet a recurring person" | "Meet someone who sticks around" | "Recurring person" was internal vocabulary. |
| recovery hint: "opens when injury, Heat, or a story consequence makes it relevant" | "Take an injury or pick up Heat to unlock Recovery" | Names the trigger instead of describing a rule. |

**`Lay Low` is unchanged** — a distinct action with a distinct result.

---

## Decisions taken during implementation

- **Reactive trigger tier added.** Not in the original brief. `dre_after_payoff`
  fires on clearing the note; a beat that only appears 55% of the time when the
  player has just caused it reads as a bug, not as variety.
- **Per-day story cap (2).** Without it the chain tier consumed the registry by
  Day 4 and every run resolved every storyline — a different route back to the
  v0.6 problem.
- **Anti-monopoly is a hard filter, not a weight multiplier.** A ×0.35 penalty
  cannot stop a chain that is the only candidate in its tier. The streaking chain
  is now dropped whenever anything else is eligible, which enforces the
  two-in-a-row rule and still never blocks a chain with no competition.
- **Trust gate on `mara_boundary`.** She only asks the hard question if something
  is there. Without it the arc completed in 96% of runs; the brief asked for
  50–70%.
- **Ambient quiet bonus.** +0.16 when nothing at all has fired for five slots, so
  a week cannot go silent for two in-game days.
- **`maraStatus` treats departure as authoritative.** It previously recomputed
  from trust and silently walked her departure back — a real bug found by test.
- **`sanitizeStreetName` rejects non-strings** rather than coercing them;
  `String({})` was yielding "object Object".
- **No profanity filter.** Local single-player, blocklists are unwinnable, and
  character-set sanitation covers the real risk (layout breakage / injection).
- **Pherris Dickens is canonical.** The ClickUp "Mina Vale" entry is retired.

---

## Verification

### Automated suite

`node --test tests/*.test.js` — **68 passed, 0 failed** (was 40).

New file `tests/story-chains.test.js` (14 tests) validates registry shape,
unique ids, unbroken chain stages, out-of-order unreachability, ambient-tier
purity, copy length against the §1 standard, preview leakage, determinism,
opening variance, the anti-monopoly rule, reactive firing, and cooldowns.

Additions to `tests/game-core.test.js` cover name sanitation and defaults,
pre-v0.7 save hydration, the save preview, chain-progress recording, the
no-double-tick rule, betrayal removing Mina, and all three Day 7 outcomes.

Additions to `tests/ui-contract.test.js` cover the three aspect tiers, the
preserved Tier A rule, Finish Trading, the Street Name field, and metadata
leakage into `ui.jsx`.

### Deterministic simulation

`node tests/simulate-runs.js 200` — **600/600 runs terminated, 0 dead ends.**

| Profile | Story | Ambient (distinct) | Total | Mina ≥4 | Mina ≥6 | Quiet |
|---|---|---|---|---|---|---|
| cautious | 7.1 | 5.2 (4.0) | 12.3 | 42% | 8% | 9/200 |
| balanced | 6.8 | 6.6 (5.2) | 13.4 | 22% | 1% | 7/200 |
| aggressive | 4.3 | 3.7 (3.4) | 8.0 | 0% | 0% | 161/200 |

**Opening variance: 26 of 30 distinct sequences** (baseline: 1).

### Honest reading of the simulation

Two measurement corrections were made during this pass and both changed the
conclusions:

1. An early probe measured Mina ≥4 at 96% — but it never travelled, so it sat in
   Spenard all week. Her chain is district-gated to the Night Owl.
2. A `chainStall` metric derived from `run.eventHistory` undercounted, because
   that map is keyed by id and repeat firings overwrite earlier slots. The
   simulation now instruments the run loop directly.

The aggressive profile reaches Mina 0% of the time because its route never
returns to Spenard. That is the design working. Its high quiet count is largely
an artifact of the bot spamming Rob: `ROB`, `ELI_TEST_ROUTE`, and
`TAKEOVER` pass `suppressStory: true` so they never stack two modals on one tick,
so those slots roll no beat. A human uses Rob rarely — it is gated to
working capital below $150.

**Human playtest is required** to settle the true Mina frequency; the bots
bracket it between 0% and 64% depending on travel behavior.

### Not done

- **The `stickup` simulation profile** planned for this pass was dropped: it robs
  Goodie, who is deferred to v0.7.1. Adding a profile for a system that does
  not exist would have produced a meaningless number.
- **Browser/mobile QA across the ten planned viewports has not been run.** The
  CSS tiers are asserted by contract test, not by rendering. This must happen
  before the build is called verified. The checklist below is ready to run.

---

## Manual browser QA checklist

**Not yet run.** This build's title fix is unverified until someone works through
this. A string-matching contract test is not evidence for a change whose whole
purpose was visual.

It has to be done on a machine with normal internet access: `index.html` loads
React, ReactDOM, and Babel from `unpkg.com`, which is unreachable from the build
environment (`cdn.jsdelivr.net` and `esm.sh` are blocked there too; only
`registry.npmjs.org` and `fonts.googleapis.com` resolve). Without those three
scripts the app does not boot at all.

### Setup

```sh
cd 907Hustle-game
python3 -m http.server 4173
# open http://localhost:4173
```

Use the browser's device-toolbar to set each viewport exactly. Reload between
sizes — the tiers are media queries and some browsers keep stale layout.

### Which tier each viewport should hit

The artwork is 941×1672, aspect **0.563**. The tier boundaries are viewport
aspect ratio, not width.

| Viewport | Aspect | Expected tier |
|---|---|---|
| 320×568 | 0.56 | **A** — unchanged from v0.6 |
| 375×560 | 0.67 | **A** (also hits the `max-height:600px` rule) |
| 375×667 | 0.56 | **A** |
| 390×844 | 0.46 | **A** — the parity reference |
| 430×932 | 0.46 | **A** |
| 768×1024 | 0.75 | **B** — cover, recentred |
| 1280×800 | 1.60 | **C** — contain over blurred backdrop |
| 1440×900 | 1.60 | **C** — the original defect case |
| 1920×1080 | 1.78 | **C** |
| 2560×1080 | 2.37 | **C** — widest crop risk |

**Tier A** — `.title-art` is `object-fit: cover`, `object-position: center top`.
`.title-backdrop` is `display: none`. Controls sit at the bottom under a 52vh
push.

**Tier B** — still `cover`, but `object-position: center 30%` so the crop takes
from both ends rather than only the bottom. Content padding drops to 34vh.

**Tier C** — `.title-art` becomes `object-fit: contain`, `.title-backdrop`
becomes `display: block` (the same image, blurred and darkened, filling the
letterbox). Controls move to a right-anchored 420px column over a scrim.

### Check at every viewport

- [ ] No horizontal scrollbar. `document.documentElement.scrollWidth` equals `clientWidth`.
- [ ] Load Game, New Game, and How to Play are all fully visible without scrolling.
- [ ] Every one of those three is at least 44px tall.
- [ ] The artwork is not stretched — faces and lettering keep their proportions.
- [ ] Browser console shows zero errors.

### Check at Tier C specifically (this is the fix)

- [ ] **The full composition is visible.** At 1440×900 the v0.6 build discarded
      roughly 65% of the image, cropping everything below the top third. All of
      it should now be on screen.
- [ ] **No black bars.** The letterbox either side is filled by the blurred
      backdrop drawn from the artwork itself.
- [ ] The three controls sit in a right-hand column and stay readable against
      whatever part of the art is behind them.

### Parity check — the constraint on the whole fix

Tier A had to come through untouched.

```sh
git stash            # or check main out into a second directory
git checkout main
# screenshot the title screen at 390x844
git checkout claude/907hustle-story-playstyles-d5huyw
# screenshot again at 390x844 and compare
```

- [ ] The 390×844 title screen is **pixel-identical** between `main` and this branch.

### Worth checking while you are in there

- [ ] Edge screen at 320px wide: the Street Name field does not overflow, is at
      least 44px tall, and accepts at most 16 characters.
- [ ] Skipping the name and picking Silver-Tongued Hustler yields "Silver" in the
      opening log line.
- [ ] The bottom action button reads **Finish Trading**, and its sub-label names
      the actual next part of day (Afternoon → Evening → Night → "Day 2, Morning").
- [ ] Return to title after saving: the saved-run preview shows the street name
      on its first line.

### Results

Fill in when run.

| Viewport | Tier | No overflow | Controls ≥44px | Art undistorted | Console clean | Notes |
|---|---|---|---|---|---|---|
| 320×568 | A | | | | | |
| 375×560 | A | | | | | |
| 375×667 | A | | | | | |
| 390×844 | A | | | | | |
| 430×932 | A | | | | | |
| 768×1024 | B | | | | | |
| 1280×800 | C | | | | | |
| 1440×900 | C | | | | | |
| 1920×1080 | C | | | | | |
| 2560×1080 | C | | | | | |

390×844 parity with `main`: ☐ identical ☐ differs — if it differs, the Tier A
rule in `v05.css` has been disturbed and that is a regression, not a tuning
question.

If Tier C still looks wrong after this, the CSS is not the remedy and the
landscape asset specified below should be commissioned.

---

## Desktop artwork specification

Only needed if the CSS tiers prove insufficient in browser QA. The current fix
requires no new asset.

- **Landscape master:** 2560×1440 (16:9), sRGB. WebP with PNG fallback, WebP
  target ≤400 KB.
- **Safe area:** title lockup and primary figure inside a centered 1600×1080 box
  (62.5% × 75%), so crops from 21:9 down to 4:3 never cut them.
- **Bottom 26%** (~375px) reserved for the control scrim — no critical detail.
- **Right 30%** kept low-detail while the right-hand control column is in use.
- **Delivery:** replace `<img className="title-art">` with a `<picture>` carrying
  `<source media="(min-aspect-ratio: 1/1)">` and the existing portrait PNG as the
  default `<img>`.
- **Separately:** the shipped 1.9 MB PNG should be re-encoded to WebP q82
  (expected 180–260 KB) when an asset pipeline exists. Not done this pass.

---

## Deferred

**To v0.7.1:** Eli (5 stages), Dre (5 stages), Curtis (6 stages) · Goodie and
the Stickup Track · EndModal three-part authored recap · absorbing the orphaned
`mid` encounter and `rook_cut` fully into `rook_pressure`.

**Indefinitely:** Street Read XP implementation (specified in
`PROGRESSION_DESIGN.md`) · persistent meta-progression · leaderboards ·
generalized robbery framework · combat expansion · save-schema restructuring ·
new desktop art asset.
