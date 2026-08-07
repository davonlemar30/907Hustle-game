# 907Hustle: One Good Run

907Hustle: One Good Run is a mobile-first, single-player crime, trading, resource-management, and light RPG web game set in an Anchorage-inspired version of Spenard.

The current playable build is **v1.0: Organization Layer**. The player begins as a broke newcomer staying with family, works through a seven-day run, manages Dre's debt, trades and hustles for money, develops relationships and reputation, acquires the North Star Garage, and can grow into an operator who controls blocks through soldiers and lieutenants.

The game uses a classless progression model. Access and identity emerge from behavior, attributes, relationships, Street Read, Respect, money, property, crew, and territory rather than a fixed class path.

## Current Build: v1.0

v1.0 extends the v0.9 daily-life foundation with a midgame organization layer.

### Core gameplay

- Seven-day run with Morning, Afternoon, Evening, and Night
- Three active districts: Spenard, Downtown, and Industrial Service Roads
- Four-product market with seeded price movement and weighted-average cost basis
- Buy/sell previews with revenue, cost basis, projected profit or loss, cash after, and cargo after
- Legal work, exploration, gym training, informal gambling, shoplifting, transit, relationships, and property progression
- Dre debt management with reserve-aware payments and physical enforcement at the Day 7 deadline
- Heat, Health, Recovery, gear, protected storage, garage upgrades, crew, Respect, and territory
- Autosave, title screen, New Game, Load Game, save preview, and mobile-first navigation

## Organization Layer

### Soldiers

Soldiers are anonymous manpower hired with cash and assigned to controlled Spenard blocks.

- Soldier capacity scales with controlled territory
- Claiming a block requires an available soldier
- Successful claims immediately post a soldier to the new block
- Assigned soldiers generate passive dirty income through the existing `advanceRun` pipeline
- Soldiers can be lost to raids, arrests, and attrition
- Survivors from a lost block return to the available manpower pool

### Territory Blocks

Spenard currently contains six claimable blocks.

Each block has:

- earning potential
- Heat exposure
- Rook visibility
- patrol frequency
- manpower requirements

Eli's territory intelligence reveals block stats before expansion. Without that intelligence, the player operates with incomplete information.

### District Control

Territory Blocks are the tactical layer. District Control is the neighborhood-level strategic layer.

Spenard progresses through:

- Presence
- Influence
- Dominant
- District Control

Block income owns the passive territory payout where the block layer exists, preventing duplicate district income. District Control provides broader strategic benefits and creates a foundation for future Downtown and Industrial block expansion.

### Lieutenants

Two specialist lieutenant roles drive the organization layer.

**Eli "Shortcut" Ward — Operations**

- soldier positioning
- block rotation
- territory defense
- operational efficiency
- automated manpower management

Eli can run one standing operations policy:

- Balanced
- Maximize Income
- Hold Ground
- Stay Quiet
- Manual

Policy changes and automated redistribution consume no additional player time.

**Kip Sallis — Finance**

- dirty-to-clean cash conversion
- laundering capacity
- financial Heat reduction
- legitimate money management

Kip is a finance specialist and stays outside field crew assignments.

### Dirty and Clean Cash

v1.0 tracks money as:

- `player.dirtyCash`
- `player.cleanCash`
- `player.cash`

The core invariant is:

```text
cash = dirtyCash + cleanCash
```

Ship Creek work enters as clean income. Street income generally enters as dirty cash.

Kip launders dirty cash at a flat **15% fee**. Clean cash avoids financial Heat from spending and supports legitimate purchases.

### Rook

Rook escalation now follows **Respect**.

- Respect represents the player's growing street presence and influence
- Heat represents police attention
- Rook's escalation stage reacts to Respect and organization growth
- Legacy saves preserve already-earned Rook progression

### Dre

Dre's debt remains the central seven-day obligation.

- The fresh-arrival note is due on Day 7
- Unpaid debt at the deadline can trigger collector enforcement
- Collector severity scales with the remaining balance
- Killing collectors increases future enforcement cost through Dre's interest multiplier
- Paying the debt in full prevents collector escalation

## Story and Relationships

The current build preserves the authored character and event systems from v0.9.

- **Mara Velez:** relationship progression with friendship, romance, boundaries, danger, and Day 7 outcomes
- **Eli Ward:** contact-to-crew-to-lieutenant progression
- **Dre Holloway:** lender relationship, payment behavior, warnings, and enforcement
- **Rook Mercer:** rival escalation driven by Respect
- **Kip Sallis:** dealer progression that can grow into a finance lieutenant role

The live story system remains data-driven through `STORY_REGISTRY` in `game-core.js` and uses seeded deterministic selection.

## UI / UX

The interface is a mobile-first single shell built on menu hubs and progressive
disclosure. A Day 1 arrival does not inherit a Day 6 operator's interface:
systems appear in the menus only once the run has unlocked them.

### Primary navigation

Five bottom-bar destinations, icon over label:

- **Home** — situation overview and the run's anchor
- **Market** — the hero trading surface, always one tap away
- **Travel** — where to go, how to get there, what is around you
- **People** — personal, street contacts, crew, lieutenants
- **More** — Finances, Operations, Recovery, Character, Street Read, Help

Navigation sits at the bottom edge where a thumb reaches it. The header is one
status line (day part, district, cash, status drawer, menu); a pressure row of
Heat / Debt / Respect chips appears only once one of them is applying pressure.

### Home

Home is the landing screen for a new or loaded run and the calmest screen in the
game. It answers where you are, what part of the day it is, what you have, what
is pressing, and where you might go next — nothing else. Its model comes from
`selectors.homeSituation`, which produces an authored situation summary, at most
two priorities, and a per-system unlock map so empty systems stay hidden rather
than rendering as `Soldiers: 0`.

### Menu hubs

Each hub lists destinations; each subpage answers one gameplay question and
carries an explicit Back control.

```text
Travel      → Destinations · Around <district> · Home · Transit · Local Intel · Listings
People      → Personal · Street Contacts · Crew · Lieutenants · Recent History
Operations  → Overview · Safehouse · Territory · Soldiers · District Control · Gear · Quick Score
Safehouse   → Protected Cash · Storage · Upgrades · Assignments
Finances    → Overview · Debt & Obligations · Laundering · Financial Risk
```

High-level surfaces name systems and world state (Debt, Territory, District
Control, Heat, Respect, Crew, Soldiers, Financial Heat). Character names appear
in the detail that concerns them — the lender is named on the Debt page, not in
the persistent HUD.

### Action feedback

Any action that consumes part of the day raises a compact action-result overlay:
what happened, the money that moved, the important result, and — most
prominently — the time it cost (`MORNING → AFTERNOON`). It auto-dismisses, and a
tap anywhere closes it early, so routine actions never cost an extra deliberate
tap.

Action results are deliberately separate from story. The receipt is short and
system-focused; narrative, choices, and relationship consequences keep their own
event surfaces. Richer surfaces still own their outcomes: takeovers keep the
operation modal and a crossed day keeps the day summary, and the receipt stays
silent rather than stacking on top of them.

The overlay is driven by `selectors.actionResult(before, after, actionType)`, a
pure diff of two committed states. The shell routes every dispatch through one
wrapper so no time-consuming action can slip past it, and the reducer is
untouched.

### Mobile standards

- 44px minimum visible control height, verified by measurement in Chromium
- zero horizontal overflow at 320, 375, 390, 430, and 375×560 reduced height
- bottom navigation fully on screen with five cells above 44×44
- player-facing time shown as day parts
- nested screens use explicit Back controls
- trading remains the strongest primary gameplay surface

## Deterministic Architecture

907Hustle uses one central gameplay clock and one seeded RNG path.

- `advanceRun` owns time advancement
- passive soldier and territory resolution runs inside the same pipeline
- organization activity consumes no hidden extra turns
- deterministic RNG is preserved across combat, events, territory, raids, and passive systems
- save version remains `3`
- older compatible v3 saves hydrate through additive defaults and migration rules

## Verification

Current automated verification:

```sh
node --test tests/*.test.js
node tests/simulate-runs.js
```

Latest recorded results (v1.1 navigation pass):

- **171 / 171 automated tests passing**
- **2,000 simulated runs across 10 strategies, byte-identical to the pre-pass baseline**
- operator strategy covers garage, Eli, soldiers, territory, Kip, and laundering progression
- zero simulation crashes reported
- Node-driven end-to-end organization run completed through save/load

The navigation pass added domain tests for the two new presentation selectors
(`homeSituation`, `actionResult`) and UI-contract tests for Home, the five-cell
bottom navigation, the Travel/Operations/Finances/Safehouse hubs, progressive
disclosure, and the action-result overlay.

### Rendered verification

v1.1 was verified in real Chromium (Playwright) at 320×568, 375×667, 390×844,
430×932, 375×560 reduced height, and 1280×800 desktop, driving the actual
`index.html` with cache-busting and `no-store` so a stale preview cannot fake a
pass: **486 measured checks, all passing**, covering horizontal overflow,
touch-target height, bottom-nav reachability, action-result content and time
label, every day-part transition, and the full save → title → load → Home cycle.

That pass found a **pre-existing layout bug that also reproduces on the previous
main**: `.app` and several number grids declared bare `1fr` tracks. A bare `1fr`
is `minmax(auto,1fr)`, and that `auto` floor is the item's min-content width, so
nowrap HUD and monospace content forced the shell to 687px inside a 320px
viewport and the whole page scrolled sideways. Every affected track is now
clamped to `minmax(0,1fr)`, with a regression test asserting the clamped rule is
the last one to apply.

The final v1.0 stabilization pass verified the full flow:

```text
garage
→ Eli recruitment
→ Eli promotion
→ soldier recruitment
→ territory claims
→ passive income
→ Eli policy change
→ Kip introduction
→ laundering
→ Day 7 Dre enforcement
→ save/load
```

Human playtesting on a physical device is still recommended for feel and pacing.
Two limitations of the automated rendered pass are worth naming: the sandbox
proxy blocks `unpkg.com`, so React/ReactDOM/Babel were served from locally
vendored copies of the exact pinned versions `index.html` requests, and Google
Fonts were unavailable, so Anton and Barlow Condensed rendered as fallbacks.
Every 907Hustle file under test — `index.html` markup, `v05.css`,
`game-core.js`, `ui.jsx` — was the real one. Final typography and the title
artwork tiers still deserve a look on a real handset.

## Run Locally

Serve the repository with any static HTTP server, then open `index.html`:

```sh
python3 -m http.server 4173
```

Then visit:

```text
http://localhost:4173
```

The active runtime is:

- `index.html`
- `v05.css`
- `game-core.js`
- `ui.jsx`

`game-core.js` is a UMD domain module exposed through `window.GameCore` and `module.exports`. `ui.jsx` contains the React presentation layer.

## Save Compatibility

- Save version: `3`
- Save key: `907ogr_v3`
- v0.9 and v1.0 state additions hydrate through additive defaults and migration rules
- pre-existing cash migrates into the dirty-cash model
- legacy Rook progression is preserved during the Respect migration
- older compatible v3 saves remain playable

## Project Direction

The current progression arc is:

```text
street-level survival
→ working/trading/hustling
→ garage ownership
→ crew growth
→ Eli as Operations Lieutenant
→ soldiers and Territory Blocks
→ passive organization income
→ Kip and laundering
→ District Control
→ larger rival and law-enforcement consequences
```

Near-term development priority:

1. human playtesting of the v1.1 navigation on a physical handset
2. balance validation of the v1.0 organization systems
3. stronger District Control rewards and capstone presentation
4. later expansion of block territory into Downtown and Industrial

## Documentation

Key repository references:

- `VISION.md` — long-term design target
- `ROADMAP.md` — build sequence
- `PROJECT_STATUS.md` — architecture, verification, and current limitations
- `STORY_BIBLE.md` — character voices, story standards, and event chains
- `ALPHA_V0.9.md` — v0.9 daily-life foundation
- `EIGHTH_PLAYTEST_AUDIT.md` — v0.9 verification record
- `COPY_REVIEW.md` — current narrative-copy review
- PR #52 — v1.0 Soldiers, Territory, Lieutenants, Laundering, and stabilization work

The ClickUp 907Hustle Master Doc remains the broader design and playtesting source of truth.

## Legacy Files

`index.html` loads only `v05.css`, `game-core.js`, and `ui.jsx`.

These files remain for historical reference and are outside the active runtime:

- `events.js`
- `script.js`
- `style.css`
- `combat.js`
- `907hustle/`
- `assets/cousins-apt-placeholder.svg`

The live event set is `STORY_REGISTRY` inside `game-core.js`.
