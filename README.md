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

The current interface uses progressive disclosure and a mobile-first single shell.

Primary navigation:

- Market
- Travel
- People
- More

Nested surfaces include:

- Operations
- Finances
- Recovery
- Character
- Territory Blocks
- District Control
- Soldiers
- Safehouse
- laundering

Current mobile standards:

- 44px minimum visible control height
- no horizontal overflow at 320, 375, 390, and 430px target widths
- player-facing time shown as day parts
- nested screens use explicit Back controls
- trading remains the strongest primary gameplay surface

The **next planned build is a dedicated UI/UX and mobile-presentation pass**. Its focus is stronger visual hierarchy, reduced information density, clearer organization surfaces, improved warning/feedback states, and a more cohesive presentation for the v1.0 systems while preserving the established mobile shell.

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

Latest recorded v1.0 results:

- **138 / 138 automated tests passing**
- **24 stabilization and regression tests added during PR #52**
- **800 simulated runs across 10 strategies**
- operator strategy covers garage, Eli, soldiers, territory, Kip, and laundering progression
- zero simulation crashes reported
- Node-driven end-to-end organization run completed through save/load

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

A final real-browser/mobile visual QA pass remains recommended because the development sandbox encountered a script-cache mismatch during the latest UI verification attempt.

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

1. UI/UX and mobile presentation pass
2. human browser playtesting and balance validation of v1.0 organization systems
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
