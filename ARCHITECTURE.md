# ARCHITECTURE

How 907Hustle: One Good Run is put together, current as of **v1.34**. This file
is meant to be the only thing you need to read before changing code; for *why*
the game is designed the way it is, see the ClickUp docs at the bottom.

## The run has no fixed length

**There is no day cap and no timed ending.** The player hustles indefinitely. As
of **v1.31 this is true of the code as well as of this file** — and until v1.31
it was not.

**What this section used to say, and why it was wrong.** It read: *"`RUN_DAYS` is
a debt deadline and checkpoint constant… it has never terminated a run."* That
sentence was false for as long as it was written. `confirmDayEnd` carried this:

```js
if (state.run.phase === "pressure" && oldDay >= checkpointDay(state)) {
  state.run.dailyActions = []; endRun(state);
```

No obligation check, no health check, no Heat check — a day count, ending the
run. `startPressurePhase` set `checkpointDay = day + PRESSURE_DAYS`, Week Zero
finished around day 3, and every run therefore stopped around **day 10**. The
second one was quieter: `EXECUTE_FINAL_PLAN`, the only ending the player
chooses, was dispatchable on exactly one day. Six builds of balance work were
measured against a boundary this file denied existed, and the denial is why
nobody went looking for it.

**A run now ends four ways and four only.** Three are failures and one is a
choice:

1. **an obligation you cannot pay** — rent (three household warnings → eviction),
   the phone, or Dre's note
2. **health at zero**
3. **Heat at the terminal 15**
4. **the player calling the final score** — `PREPARE_FINAL_PLAN` then
   `EXECUTE_FINAL_PLAN`, on whatever day they like

A solvent, healthy, cool player is never stopped: a v1.31 test drives one past
**day 60** and a manual walk reached **day 756** still playing. An unpaid run
still ends in eviction around day 29, the v1.26 number, unchanged.

**`RUN_DAYS = 7` is now only an income-projection constant** (`collectedPerRun`).
The loan has its own term, `LOAN_TERM_DAYS = 7`, counted from the day it is
taken — it used to inherit `run.checkpointDay`, which meant removing the
checkpoint naively would have deleted a lose condition rather than freed one.
`run.checkpointDay` survives as a **story-pacing marker only**, read by
`lateRunDay()` and nothing else, because three authored beats were timed against
it and should still fire when they did. It cannot end anything.

**The harness owns its own boundary**, which is what it always should have been.
`tests/simulate-runs.js` takes a per-strategy `maxDays` (default **40**) and
exits through the same voluntary ending a player uses. Strategies that go broke,
get hurt, or get arrested leave earlier through the real fail-state.

**This immediately unblocked the block layer.** Three consecutive handoffs
recorded that no strategy had ever claimed a corner, so every territory constant
tuned since v1.20 was unverifiable. The cause was arithmetic, not economy: the
`territory` strategy bought the garage on average **day 7.3** and the run was
taken away at day 10, leaving no room for the four rungs above it (Eli, the
promotion, a soldier, the claim). At a 40-day horizon it claims corners in
volume, and its average net worth went **79 → 1,452** — from last place in the
table to second. It was never a weak strategy. It never got to finish.

## The shape of it

A single-player, mobile-first web game. No backend, no framework beyond React,
no runtime dependencies. State lives in one reducer; the save is one JSON blob
in `localStorage`. A run is **7 days x 4 parts** (Morning, Afternoon, Evening,
Night): Week Zero is the opening stretch that establishes the player's life in
Spenard, then the pressure phase runs to a checkpoint day.

## File map

```
index.html            Loads React UMD (production) + ui.built.js. Nothing else.
ui.built.js           BUILD OUTPUT, committed. Never edit; run `npm run build`.

src/index.jsx         Bundle entry. Import order matters (see Build).
game-core.js          The barrel: all game logic, state, and the reducer.
ui.jsx                Every screen in the game, one file.
encounters.js         Authored encounter construction.
v05.css               The entire stylesheet.

src/ds/                 Presentational primitives shared by the game and the
                        synced claude.ai/design bundle. Props in, JSX out.
  primitives.jsx        Hud, Chip, PageHead, Outcome, CategoryCard, MenuRow,
                        StatTile, PlaceAction, Modal, BadgeHeader,
                        AccordionSection, ActionCard. May not touch
                        window.GameCore — a primitive that reads game state is
                        a screen and belongs in ui.jsx.
  index.jsx / index.d.ts  Export surface for `build:ds` + hand-written props.

src/data/               Static definitions. No logic, no state.
  products.js           PRODUCTS, PRODUCT_BY_ID
  locations.js          NEIGHBORHOODS, TERRITORIES (district layer), SPENARD_BLOCKS
                        (block layer), HOME_DISTRICT_ID, AREA_BY_ID
  districts.js          DISTRICT_MODS (difficulty + heat per track), DISTRICT_ADJACENCY
                        (bleed graph), STICK_TARGETS, plug turf and suspicion
  attributes.js         Attribute defs, label tiers, advantage thresholds, GROWTH_RATES,
                        GROWTH_ATTRIBUTES, gym activities, IDENTITY_MATRIX,
                        OUTCOME_SHAPES, OUTCOME_OBSERVATIONS, STANDING_PACING
  items.js              GEAR, BASE_UPGRADES (re-exports the 907List catalogue)
  market.js             907List: LISTING_ITEMS, MARKET_TIERS, ROBBERY, buyer requests
  jobs.js               SPENARD_JOBS, JOB_APPROACHES, JOB_RANK_THRESHOLDS, STARTER_JOB_IDS
  npcs.js               CREW, DEALERS, PLUGS, HOUSEHOLD_NPCS, NIGHT_OWL_REGULARS
  observations.js       OBSERVATION_CATEGORIES, createObservation(), addObservation()
  npc-lenses.js         ARCHETYPES, SHARED_EVENT_WEIGHTS, NPC_LENSES, resolveLens()
  nile.js               Floor hours, discovery and vouch paths, ambient text,
                        Selam and Biniam dialogue by band, table access gates
  mina.js               A line pool per band split by shift, state-reactive pools
  gambling.js           Tonk and Cee-lo rules: deck, hand value, dice, odds, settlement
  propagation.js        CHANNELS, NPC_CHANNELS, Curtis's filter, heat thresholds
  crew.js               Loyalty scale (0-10), tier requirements, wage curve,
                        presence-effect framework, RECRUITMENT_PROOF and the
                        recruitmentEligible() predicate, the Made Men modifier
                        triangle (TONE_DEFENSE_MULTIPLIER / DESHAWN_HEAT_REDUCTION),
                        Made Men / Guards note
  curtis-awareness.js   Phases and floors, watcher pools, phase texts, chance formula
  territory.js          Police-raid and Curtis-move constants, the phase visibility
                        gate, RAID_DEFENSE_PER_SOLDIER — the whole nightly balance
                        surface for the block layer, in one place — plus the
                        nightly plan's target depth and pressure budget, and the
                        gossip-warning scope/timing constants and Deshawn tiers
  gossip.js             The voices that carry block news to the player: the two
                        gossip events, seven authored lines each, the Deshawn
                        pressure clause, gossipText() / gossipSender()
  disclosures.js        What people sell you and at what accuracy: the intel-type
                        table with prices and staleness, the seven npc/type/band
                        rows, accuracyFor(), the stringHash jitter, the voices
  arrest.js             Bail, priors, processing slots, heat relief, crew jail, copy
  disposition-bands.js  BANDS, bandFor()

src/systems/attributes.js   resolveWithAttribute() / resolveAction(), streak reads,
                        attributeGrowth(), getStreetIdentity(), standing pacing.
                        Pure — reads state, never writes.

src/events/
  registry.js           ENTITY_REGISTRY, ENTITY_MATCH_ORDER, EVENT_FLAVOR, EVENT_CONTEXT
  cards.js              event(), effectPreview(), activeEvent() — every event card
  random.js             Seeded RNG + isEligible() / getWeight()
  market-events.js      907List rolls: robbery risk, snipes, flakes, sale price, bulk
  gambling-events.js    A hand of Tonk / round of Cee-lo played against the attribute
                        system: what the player may see, what the session grew

src/exposure/engine.js  Ledgers in, dispositions out, gossip in between.
src/selectors.js        Tiny pure reads shared by game-core and src/events,
                        including the v1.20 block-intel ladder
src/hash.js             stringHash() / HASH_CEILING. A leaf: requires nothing, so
                        the selectors and random.js can both use it

tests/                  node --test, no runner config
  simulate-runs.js      Seeded whole-run simulator (not a test; a harness)
  measure-lieutenant-modifiers.js  v1.20 A/B harness for the territory modifiers
  exposure-helpers.js   putInBand(), for tests that used to assign a trust integer

scripts/check-docs-version.js   Warns when this file's version lags PROJECT_STATUS.md
```

**Every `src/data/*`, `src/events/*`, `src/systems/*`, and `src/exposure/*`
module is forbidden from requiring `game-core.js`.** The dependency runs one way:
game-core requires them. `src/selectors.js` exists so `src/events/cards.js` can
read run state without reaching back and creating the cycle. Those modules are
also barred from `Math.random()` and from `run.rngState` — see *Testing*.

**`game-core.js` is a barrel.** It requires from `src/` and re-exports through
one `api` object. Its export shape is a contract: `ui.jsx` and every test read it.

### Where do I put a new thing?

Anything whose home is obvious from the file map is left out here. These are the
ones that land in two places, or in a place you would not guess.

| Adding | Goes in |
|---|---|
| A story beat / character arc card | `src/events/cards.js` **+** a descriptor in `STORY_REGISTRY` |
| A new NPC | `src/data/npcs.js`, state in `createNpcState()`, a lens in `NPC_LENSES`, channels in `NPC_CHANNELS`. The `createNpcState()` record is **not optional**: the loop that hands out ledgers skips any lens with no record, so a lens alone is a subscriber that silently hears nothing |
| A recruitment gate that reads a ledger | an entry in `RECRUITMENT_PROOF` (`src/data/crew.js`) — data only. `crewRecruitmentEligible()` in game-core resolves the band and score and passes them in |
| A lieutenant modifier on the territory layer | a table in `src/data/crew.js` **+** one read at the seam it acts on (`resolveSoldierOperations`, `territoryHeatChance`, `blockIntelLevel`). Derived from the crew record, never stored |
| An outside-the-player modifier on an attribute roll | the `bonus` argument of `resolveAction()`, sourced from `Crew.combatAdvantageFor()`. One seam, so the ceiling is enforced in one place |
| A new growth source | a rate in `GROWTH_RATES` **and** an attribute in `GROWTH_ATTRIBUTES` — half a definition trains nothing, silently |
| A card or dice rule | `src/data/gambling.js`; how it plays against an attribute goes in `src/events/gambling-events.js` |
| A new observation category | `OBSERVATION_CATEGORIES` **+** a weight in all four archetypes |
| A named letdown (something that costs standing) | `SHARED_EVENT_WEIGHTS` in `src/data/npc-lenses.js` |
| A thing an action makes visible | `OBSERVED_ACTIONS` in `game-core.js` |
| A new outcome-tiered action | a shape in `OUTCOME_SHAPES` **+** a map in `OUTCOME_OBSERVATIONS` |
| A 907List probability roll | `src/events/market-events.js`, hashed off the seed |
| Tooltip copy for a name, or ambient street lines | `ENTITY_REGISTRY` / `AMBIENT_FLAVOR` in `src/events/registry.js` |
| A new action the player can take | a case in `reduceGame` (`game-core.js`) |
| A Mina counter line | `MINA_LINES` (band + shift) or `MINA_STATE_LINES` |
| Attribute resolution, growth, or identity **logic** | `src/systems/attributes.js`; the numbers stay in `src/data/attributes.js` |
| A new screen | `ui.jsx` |
| A reusable piece of chrome two screens both want | `src/ds/primitives.jsx` **+** its props in `src/ds/index.d.ts` |

## Build and deployment

```bash
npm install
npm run build     # esbuild, ~20ms
npm test          # node --test tests/*.test.js
npm run sim       # 200 seeded runs
npm run check-docs  # warns if this file's version lags PROJECT_STATUS.md
```

Run `npm run check-docs` before committing a build that bumps the version. If it
warns, update ARCHITECTURE.md before merging.

GitHub Pages serves this repo **directly, with no CI**, which means
**`ui.built.js` must be rebuilt and committed with any change to `ui.jsx`,
`game-core.js`, `encounters.js`, or anything in `src/`.** A test enforces that
the bundle exists and that Babel is gone, but it cannot tell you the bundle is
stale. Run `npm run build` before you commit.

React and ReactDOM stay UMD globals from `index.html`; esbuild's default JSX
factory emits `React.createElement`, which resolves to the global, so React is
never bundled. `v05.css` is linked, not bundled. `src/index.jsx` imports
`game-core.js` **before** `ui.jsx`, and `ui.jsx` reads `window.GameCore` on its
first line, so reversing the two breaks the app.

The JSX used to be compiled in-browser by `@babel/standalone`. Do not
reintroduce it: beyond the load cost, its classic-script compilation made every
top-level declaration a `window` property, which caused the `playSound` infinite
recursion. Inside the bundle, declarations are module-scoped.

## State and saves

`SAVE_KEY = "907ogr_v11"`, `VERSION = 11`, `LEGACY_SAVE_KEYS = ["907ogr_v10", "907ogr_v9", "907ogr_v8", "907ogr_v7", "907ogr_v6", "907ogr_v5", "907ogr_v4", "907ogr_v3"]`.
Top-level sections, as `createRun()` builds them:

```
version   run        player     inventory  phone      knowledge  discovered
memberships          gambling   world      base       lender     people
npc       obligations           crewMeta   record     curtisAwareness
plugs     market     hustle     jobs       contacts   onboarding   nightOwl
nineZeroSevenList    rob        boost      stick      criminalProfile
home      flags      encounterLog          effects    stats      streetRead   log
```

| Section | Holds |
|---|---|
| `run` | day, slot, seed, `rngState`, `phase` (`week_zero` \| `pressure`), `checkpointDay`, `pendingEvent`, `pendingEncounter`, `eventHistory`, `recentEvents`, `pendingObservations` (gossip in transit), `pendingArrestSlots` (parts of day a booking still owes), `currentVisit` (the market-visit trade counters `END_MARKET` reads) |
| `player` | `cash` / `dirtyCash` / `cleanCash` (money is split by provenance), `heat` (**0-15**), `health`, `energy`, `attributes`, `attributeProgress` (fractional growth banked toward the next whole point), `gymStreak`, `nileStreak` + `nileStreakAttribute`, `gear`, `inventory`. **No stored `streetIdentity`** — it is derived on read |
| `world` | `currentNeighborhoodId`, `markets`, `influence`, `transport`, `locations` (gym, The Nile, employer, discount store), both territory layers (`territories` by `areaId`, `territoryBlocks` by block id), and the soldier pool `soldiers` / `nextSoldierId` |
| `gambling` | session counters plus `table` / `round`, the in-progress hand. A hand spans several dispatches and the player may close the app mid-hand |
| `record` | the permanent arrest record: `arrests`, `lastArrestDay`, `charges[]`. Purely additive, which is why the arrest build kept schema v11 |
| `npc` | the nine Exposure NPCs. Each carries a `ledger` and `channels`. The surviving `trust` / `attention` / `respect` integers are **inert** — they exist so an old save has somewhere to land, and nothing gates on them |
| `people` | `household`, `crew`, `dealers`. Crew records carry `loyalty` (0-10, starts 5), `tier`, `recruitedDay`, `wageDue` (arrears only — wages auto-deduct at day end), `wageMissedSince`, `status` (`outside` \| `active` \| `arrested` \| `departed`) |
| `crewMeta` | lifetime `totalWagesPaid` |
| `curtisAwareness` | how hard Curtis's people are looking (0-15, floors at 3/7/11, watcher-line memory, per-phase message latch) |
| `stick` | the robbery ladder: `tier` (mirror), `rep`, `casedTargets`, `retaliationQueue`, `dailyCount` |
| `boost` | the theft ladder: `tier` (mirror), `technique`, `storeBans`, `fenceStanding`, `merchandise`, `pendingCaught` |
| `criminalProfile` | `districtAwareness[district] = { market, boost, stick }` plus `bleedPending[]` |
| `home` / `base` | two separate stashes (`storedCash`, `storedInventory`). Storage only, no interest |
| `nineZeroSevenList` | the 907List broker track. `tier` and `specialist` are **mirrors, not sources** — both recomputed by `marketTier()` / `specialistCategory()` on every hydrate and after every flip, so a hand-edited save cannot grant a tier. Not to be confused with `state.market`, the plug-market visibility flag |

### Migration rules

- **Additive only.** Never remove or repurpose a field; add a new one.
- `migrateSave(value)` accepts versions **3 through 10**, `null` for anything
  older or malformed. Versions 3-9 take one flat legacy pass, not a v3→v4→v5
  chain. A v10 save skips that pass entirely — it would be lossy, rebuilding jobs
  and deleting `attributeProgress` — and takes only the v11 crew-loyalty rescale.
- `hydrateRun` captures the version **before** calling `migrateSave`, because
  `migrateSave` stamps the version to current and merges in defaults. That
  captured value is the only way to tell a pre-Exposure save from a converted
  one, and it decides whether `seedExposureLedgers` runs — which sits **after**
  `hydrateRun`, since everything between `migrateSave` and `hydrateRun` is the
  amnesty window where legacy character ids are allowed.
- To bump the version: raise `VERSION`, push the old key onto
  `LEGACY_SAVE_KEYS`, and extend `migrateSave`.

**`migrateSave` is the one place legacy character ids may appear.** The renames
(`rook`→`curtis`, `mara`→`mina`, `kip`→`goodie`, `miri`→`pherris`) are complete
everywhere else, and old saves still carry the old keys.
`tests/v1-8-1.test.js` walks every runtime source file and fails on a legacy id
found outside `migrateSave`.

## Event cards

Two halves: a **descriptor** in `STORY_REGISTRY` decides *whether and when* a
card fires, a **builder** in `src/events/cards.js` decides *what it says*.

### Descriptor shape (all 13 keys required)

```js
{
  id: "mina_intro",            // unique
  chain: "mina" | null,        // arc name; null for standalone
  stage: 1 | null,             // position in the arc; null iff chain is null
  classification: "character_intro",  // must be in CLASSIFICATIONS
  trigger: "chain" | "reactive" | "ambient",
  requires: (state) => boolean,       // the gate
  exit: (state) => boolean | null,    // retire the card early; usually null
  area: "north_star_lot" | null,      // district gate; null means anywhere
  earliest: { day: 1, slot: 0 },      // required
  latest: { day: 6 } | null,          // latest.day >= earliest.day
  once: true,                  // fire at most once per run
  cooldown: 8,                 // slots before it may repeat
  weight: 3,                   // draw weight; must be > 0
}
```

`tests/v1-8-1.test.js` validates every descriptor against this shape. A `weight`
of 0 fails, because a zero-weight card can never be drawn.

### How a card gets picked

`storyCandidates(state)` filters `STORY_REGISTRY` through **`isEligible`**
(`src/events/random.js`), `weightedPick` scores the survivors with
**`getWeight`**, and `fireStory` records the winner in `eventHistory` and sets
`run.pendingEvent`.

`isEligible` is the single gate — Week Zero hold-back, `once`, district,
`earliest`, `latest`, `recentEvents`, `cooldown`, `exit`, then `requires`. Put new
gating there, not inline in a caller. Week Zero suppresses the `dre_note` and
`curtis_pressure` chains and the `threat` / `ending_setup` classifications; both
lists are named constants at the top of `random.js`.

## The Exposure System

The oldest of the current systems, and the one that replaced every per-character
relationship integer. Understand it before touching any NPC. An NPC knows three
things: a **ledger** of typed observations (concrete facts about what you did),
a **lens** (a personality weight table deciding what those facts mean), and a
**disposition** (the sum, recomputed on every read and never stored). Because
the score is derived, *how* you earned it survives — two players at the same
number got there through different rows, and the rows are what later content and
later gossip see.

### Observations

`{ type, event, location, value, day, count, source }`. `type` is one of twelve
categories: `presence`, `honesty`, `violence`, `financial`, `heat_exposure`,
`loyalty`, `betrayal`, `discretion`, `growth`, `submission`, `defiance`,
`territory`. Rows
merge on category + event + location + source, incrementing `count`; source is
part of the key on purpose, because watching a robbery and hearing about one are
different facts. A ledger caps at 120 distinct rows.

**Diminishing returns.** `min(4, log2(count + 1))`. The clamp matters as much as
the curve: `log2` has no upper bound, so without it a patient player reaches the
top band by doing one thing four hundred times. Two rules opt out — `betrayal`
never fades, and `missed_obligation` escalates linearly (its weight is negative).

### Lenses

Four archetypes (CIVILIAN, STREET, ROMANTIC, THREAT) carry a full weight table;
an NPC picks one and overrides three to five entries, so adding a character is a
base plus a handful of numbers.

**THREAT is inverted.** For a rival, a high score is not affection, it is being
no problem to them. Everything that makes you worth noticing drives Curtis's
number *down*, which is why he reads Neutral as invisible, Cold as watched, and
Hostile as the tax and the confrontation. Use `curtisNoticed()` /
`curtisHostile()`, never a bare `>=` against him.

**Category sign is not reliable downward.** STREET scores `defiance` positively
on purpose — Dre respects nerve. Anything meaning "you cost me something" is
priced explicitly in `SHARED_EVENT_WEIGHTS` instead of inheriting its category.

**`territory` is zero in all four archetypes, deliberately.** Every other
category is evidence *about the player*, and a lens turns evidence into a
disposition. A `territory` row is evidence about **Curtis** — his people are
working Motel Row, the police swept it last night. It rides the neighborhood
channel because that is genuinely how the player would hear it, and it lands in a
ledger because a ledger is what "this person knows this" means here, but it must
never move a number: otherwise a bad week for the player's corners would quietly
make Mina like them, and the ledger would be measuring Curtis's week instead of
the player's. Willingness to pass it on is gated on the disposition that already
exists (see Gossip warnings); the news itself is worth nothing either way.

**The cast.** `NPC_LENSES` and `NPC_CHANNELS` must stay in step — every id in one
belongs in the other, and `EXPOSURE_NPC_IDS` derives from `NPC_LENSES`:

| NPC | Archetype | Channels | Reads for |
|---|---|---|---|
| `yalonda` | CIVILIAN | direct, household, neighborhood | heat at her house; `rent_paid` is weighted separately |
| `juan` | CIVILIAN | direct, household, neighborhood | growth and discretion; violence costs less with him than with his mother |
| `mina` | ROMANTIC | direct, neighborhood, network | discretion above all; `network` gossip counts **double** |
| `curtis` | THREAT (inverted) | direct, network, reputation | growth, hardest of anyone — you getting bigger is the threat |
| `dre` | STREET | direct, network | financial follow-through and honesty |
| `simone` | THREAT | direct, network | stubbed on the base table until her content exists — listed rather than omitted, so a missing lens is always a bug and never a silent default |
| `selam` | CIVILIAN | direct, neighborhood | heat and violence, doubled again at The Nile via `locationWeights`; gambling weighted to 0 |
| `biniam` | STREET | direct, neighborhood | what happens in his house. `sourceMultipliers: { network: 0 }` |
| `deshawn` | STREET | direct, neighborhood, household | loyalty and betrayal. Never on `network`, deliberately |

### Bands

Hostile `< -5` · Cold `-5..-1` · Neutral `0..2` · Warm `3..5` · Trusted `6..8` ·
Bonded `9+`. Ordered integers, so a gate is one comparison: content asks
`atLeastBand(state, "mina", BANDS.TRUSTED)`. Mapping from the retired integers:
trust 1 is Warm, 2 is Trusted, 3 is Bonded. `knowsYou()` covers the checks that
meant "any relationship at all".

### Propagation

Five channels decide who hears what and when. An event card tags an observation
with a channel; the engine routes it.

| Channel | Arrives | Presence-checked |
|---|---|---|
| `direct` | same slot | no |
| `household` | that night | no |
| `neighborhood` | 1-2 days | **yes** — slot and area both |
| `network` | next day | no |
| `reputation` | 7 days | no |

**Curtis's filter.** Only `violence`, `defiance` (which is what territory claims
and named reports arrive as), and `growth` clear his network subscription;
`financial` clears it only at $200 or more. Corner-level activity never reaches
him, no matter how often it happens. **Heat is public**: above 8 it reaches the
household on its own, above 10 the neighborhood, above 12 the network —
`propagateHeat`, no card involved.

Delayed items queue in `run.pendingObservations` and drain in `advanceRun` and
twice in `confirmDayEnd` (once before the day rolls, once after), following the
`resolveJobApplications` pattern. The 1-2 day neighborhood spread resolves by
`stringHash(seed:gossip:...)`, not the RNG stream: drawing from `run.rngState`
would make an observation's fate depend on whether an unrelated encounter took a
draw earlier that day.

### Where the writes happen

`applyEventEffect` is the one seam. Sixty relationship effects are declared
across the event cards (`minaTrust`, `lenderTrust`, `rivalRespect`,
`rivalPressure`, `npcTrust`); they stay declared as they are and are translated
into observations in `applyRelationshipEffects`. Do not rewrite the cards.
`OBSERVED_ACTIONS`, keyed on the same `context.reason` as `STREET_READ_ACTIVITY`,
covers everything funnelling through `advanceRun`. **Debugging:**
`localStorage.setItem("907_exposure_debug", "1")` renders a dev-only inspector —
each NPC's rows, the weight applied, the effective count after diminishing
returns, the running total. Never shown to a player.

## Attributes

Three numbers — **Combat**, **Charisma**, **Intelligence** — and they are the
invisible engine behind every outcome the player sees. Numbers in
`src/data/attributes.js`, logic in `src/systems/attributes.js`.

| Attribute | Domain | Decides |
|---|---|---|
| Combat | Violence | robbery, confrontation, escape, every physical outcome |
| Charisma | Social | interviews, tables, first impressions, a room at night |
| Intelligence | Economic | appraisal, price certainty, planning, when not to be somewhere |

All three start at **1** and run **0-8** in practice; `ATTRIBUTE_MAX` is 12, a
corrupt-save clamp rather than a design ceiling. **The player never sees the
number** — only a label, checked highest floor first: Green 0, Capable 2,
Solid 4, Dangerous 6, Elite 8. An earlier build carried six attributes plus
three *derived* ratings; the six were half-dead (only the physical three could
grow) and the ratings were the only thing anything read, so the middle layer was
deleted. An old save folds six into three, taking the highest of each group.

`combatRating()` / `charismaRating()` / `intelligenceRating()` survive as the
**compatibility scale**, clamped 1-5 — the range every formula written before
the merge was tuned against, so crew power, takeover odds, and trade pricing did
not silently move when an attribute became able to reach 8. Anything routed
through `resolveWithAttribute` reads the raw value and carries no inline term.

### Resolution is advantage, never a bonus

`resolveWithAttribute(pool, value, key)` in `src/systems/attributes.js` is the
**only** entry point for an attribute-modified roll.

- **0-2** — one roll against the pool.
- **3-5** — roll twice, take the better result.
- **6+** — the `catastrophic` tier is removed from the pool, then one roll.

No percentages anywhere. Being good gives you a second look and eventually takes
the worst thing off the table; it never moves a number the player cannot see.

**Pools are built, not authored.** Every wired action already computed a
context-sensitive chance from heat, gear, health, disposition, and district.
`buildOutcomePool(actionType, chance)` splits that chance across the tiers using
the ratios in `OUTCOME_SHAPES`, so all of it survives and quality is added on
top. Where an attribute term used to sit inside a chance formula it was removed
and the constant re-anchored to that formula's value at **attribute 1** — an
untrained player faces exactly the odds they always did, and everything above
comes from advantage. Carrying both would pay the player twice. `stringHash`,
never `run.rngState`: a replay of the same day must resolve the same way
regardless of what else happened first.

### Quality decides the footprint

The keystone. When an outcome resolves, its **tier** selects an entry in
`OUTCOME_OBSERVATIONS` and `broadcastOutcome` fans those out. A clean job still
writes its row — being good at crime makes you quieter, not invisible — but it
travels on `direct` instead of reaching the neighborhood and the network. Adding
an action is two data entries and no new code.

### Street Identity is derived

`getStreetIdentity(state)` is pure: dominant attribute × dominant recent
observation category (7-day window), read off `IDENTITY_MATRIX`. The nightly
assignment loop, its hysteresis, and the stored `player.streetIdentity` are gone;
an old save keeps its label as `player.historicalIdentity`, display-only.
Identity is **cosmetic** — it never gates content, modifies a roll, or touches
disposition, and Balanced means no attribute leads by more than two. The
`behavior` ledger no longer drives identity but still feeds the Character
screen's recent-reputation list.

### Growth

`attributeGrowth` uses the same `log2` shape as observation capping, for the
same reason: sessions one through three move the needle, four through seven
taper, and past that no single venue can carry you. Growth halves again once the
attribute reaches 6 — getting past Dangerous takes confrontations and real
money, not another hour on the bag.

| Attribute | Sources (base rate before taper) |
|---|---|
| Combat | Spenard Gym: bag work 0.3, cardio 0.2, sparring 0.5 (needs Combat 3, can injure) |
| Charisma | The Nile spa 0.25, Tonk 0.4, a night at the Night Owl 0.15 |
| Intelligence | Cee-lo 0.4, a 907List flip clearing 1.3x 0.2, coffee ceremony 0.15 |

A source is **two** entries in `src/data/attributes.js`: a rate in `GROWTH_RATES`
and the attribute it feeds in `GROWTH_ATTRIBUTES`. Split so a reducer never
hard-codes "this one is Charisma" at the call site, and so a half-defined source
fails loudly rather than training nothing. Sessions taper on the lifetime count
of that **specific** activity, so alternating floors at The Nile climbs faster
than grinding one table; growth returns a fraction, and whole points bank
through `player.attributeProgress`.

Two streaks, which never stack because they never address the same attribute:
three consecutive gym **days** bank `player.gymStreak` (+1 effective Combat), and
three consecutive Nile days bank `player.nileStreak`, paid to
`player.nileStreakAttribute` — whichever of Charisma or Intelligence was trained
most recently there. Both are spent on use, not carried.

### The Nile is off Curtis's network, and that is load-bearing

Two floors, two siblings: Selam runs a wellness practice downstairs (slots 0-2),
Biniam runs dice and cards upstairs behind a hookah lounge (slots 2-3). The
ground floor has four discovery paths — Night Owl board, Juan at Warm, a ramping
wander roll, a Deshawn introduction. **The second floor is not discoverable at
all**; somebody has to vouch (Selam at Warm, Juan at Trusted, or a Night Owl
regular at level 2). Table access then gates on Biniam's band: Tonk at Neutral,
Cee-lo at Warm, private games at Trusted **(implemented, no player-facing
surface yet)**.

Every observation originating there carries `location: "the_nile"` and
propagates on `direct`, `neighborhood`, or `household` only — **never** `network`
or `reputation`. Selam and Biniam are wired the same way, and `broadcastTracked`
refuses to raise Curtis Awareness at that location. This is the building's whole
strategic argument: a player carrying rival pressure can build social capital
here without feeding the attention system. A change that puts a Nile broadcast on
the network channel, or subscribes either Tesfaye to it, silently deletes the
reason the place exists. `tests/v1-11.test.js` asserts it end to end.

Two per-NPC lens hooks serve this floor: `locationWeights` scales a category by
**where** it happened (Selam reads violence at her own address at double weight),
and a zero `sourceMultipliers` entry drops a whole channel (Biniam gives
`network` gossip exactly 0 — which is why `rowWeight` reads it with `?? 1` rather
than `|| 1`, so the zero survives).

## Curtis Awareness

`state.curtisAwareness` is **how hard Curtis's people are looking**. It is not
his disposition (`npc.curtis.ledger`, what he feels) and not police difficulty
(`criminalProfile.districtAwareness`). Three numbers, three questions. Constants
and copy in `src/data/curtis-awareness.js`; every write in `game-core.js`.

A 0-15 level maps to four phases — `invisible` 0-2, `ambient` 3-6, `watching`
7-10, `approaching` 11-15 — and each installs a **floor** it can never decay
below. Once Curtis notices you, he does not fully forget.

**What raises it** (`raiseCurtisAwareness`): **+1** per observation that
genuinely lands on him through `network` — `broadcastTracked` is the seam, and it
only counts the bump when `curtis` is in the returned reach list, so an
observation failing his sensitivity filter raises nothing; **+1** for 3 or more
Spenard market transactions in a day, once per day; **+2** per successful robbery; **+1** per block lost to him, since v1.21 —
`block_lost_to_curtis` is a `defiance` row on `network`, so it clears his filter
and routes through the same seam. Losing a corner makes him hunt harder, and the
map is only six corners, so the escalation is bounded at +6 and still bleeds back
down on quiet days. **Nothing** from The Nile or the gym. **What lowers it:** the day-end block
extends `quietStreak` on any day with no criminal activity, and from the
**second** consecutive quiet day on the level bleeds a point per day, never below
the current floor.

**Watcher encounters** (`maybeWatcherEncounter`) are ambient texture, not
content: at most one per day, only while moving through Spenard on one of
`WATCHER_ELIGIBLE_REASONS`, chance `min(0.7, 0.3 + level * 0.04)`, drawn from the
phase's pool with a last-three exclusion window. They write no ledger row, raise
no card, resolve nothing. Each phase also sends one Word Around Town text, once
ever, latched in `phaseMessagesSent`. Rolled off `stringHash` — a run that never
qualifies keeps its exact event sequence.

## Crew, lieutenants, and soldiers

Two populations that are easy to confuse. **Crew** are named characters in
`state.people.crew`, defined in `src/data/npcs.js` (Eli, Pherris, Tone, Deshawn),
carrying loyalty, tiers, wages, and story. **Soldiers** are anonymous records in
`state.world.soldiers` with an id and a posting and nothing else.

### Loyalty and tiers

Loyalty is **0-10**, starts at 5, departure is 0. Pre-v11 saves stored it as a
delta accumulator centered on 0; `migrateSave` rescales with
`clamp(5 + old, 0, 10)`. Constants live in `src/data/crew.js`. Generic tier gates
are uniform in `TIER_REQUIREMENTS` — **tier 2** needs loyalty 7 and 5 days
recruited, **tier 3** loyalty 9 and 12 days — and each member layers
NPC-specific conditions on top in `crewTierAvailability`. **As of v1.19 every one
of those conditions is a domain read rather than a flat counter**: Deshawn's own
disposition at Trusted then Bonded; Pherris's market at five flips or $500 of
lifetime profit, then one controlled block plus Broker standing; Tone's three
encounter wins his backup applied to, then two blocks. Tier 3's
twelve-day gate is near-unreachable inside a 7-day pressure window; it ships as
written, centralized so it can be tuned in one place. Wages come off a per-tier
curve in `TIER_WAGES` — Deshawn's ($50 / $100 / $200), Tone's
($85 / $150 / $250), and Pherris's ($60 / $120 / $220) are authored, and anyone
without an entry keeps their flat roster wage at every tier.

Two notes on the v1.19 conversion. Pherris's tier-3 read calls `marketTier(state)`
rather than the stored `nineZeroSevenList.tier`, because that field has been a
display mirror and never the source since v1.9b; a gate reading the mirror would
open for a save that had drifted. And her tier-3 wage of $220 is larger than the
$75–$125 nightly network income the promotion unlocks, so tier 3 has to earn its
keep on the Downtown premium and the block instead — the curve was specified and
ships as written rather than tuned to make the one number positive.

`crew.trucesBrokered` survives as save state but no longer gates anything;
`BROKER_CURTIS_TRUCE` still increments it for a future gate to read.

Tone's tier-2 counter is `crew.combatWins`, incremented in the two fight
resolvers from `Crew.combatAdvantageCrewIds()` — the same exclusion-aware read
that supplies the bonus, so a win his edge did not apply to can never reach the
gate. It lives on the crew record rather than being counted out of
`encounterLog.resolved`, which truncates to its last 80 rows and would silently
reset a gate the player had already earned.

### Recruitment proof (v1.18, extended v1.19)

Some crew want proof of standing before they take a wage. `RECRUITMENT_PROOF` in
`src/data/crew.js` names the band and score floor per person, and
`recruitmentEligible(crewId, band, score)` is the predicate. **No entry means no
gate**, which is what made it additive — v1.18 predicted that giving Pherris a
requirement would be a data edit rather than a code change, and at v1.19 it was
exactly that. Eli is the only ungated crew member left. Both recruitment paths
(the scene effect and the garage `RECRUIT_CREW` action) go through
`crewRecruitmentEligible()` in game-core, so the gate cannot be walked around;
since v1.19 the roster button also *renders* the gate's reason, because an
enabled button the reducer silently refuses is worse than a disabled one.

It is band-gated rather than category-counting on purpose: the lens already
decides what counts for a given person, and re-implementing that arithmetic in
the predicate would be a second copy that drifts. The `minScore` floor exists
because a band is a wide bucket — one witnessed fight scores exactly 3.0 through
Tone's lens, which is the Warm floor on the nose, so without the floor he would
sign on after a single fight.

**Pherris's floor is 8, and it was measured rather than designed.** Her financial
weight is 4, so one 907List day scores 4.0 on its own — already past the Warm
floor of 3. Sweeping the floor across 2,000 seeded runs gives a recruitment rate
of **16.1% at 5, 14.8% at 6, 10.8% at 8, and 7.2% at 10**, and inside the
dedicated `flipper` strategy **83% / 80% / 69% / 44%**. Below 8 she is close to
automatic for anyone who touches the market at all; above it she stops being
reachable by a player who trades as one activity among several. At 8 she is
proven in 334 of 2,000 runs and hired in 215, and — the number that says the lens
works — **all of them fall inside the three market-leaning strategies, with zero
in the other ten.**

**Tone's gate deliberately does not read `curtisAwareness`.** The v1.18 build
prompt specified `curtisAwareness >= 7`. Measured over 2,000 seeded runs that is
not a difficulty but a wall: average awareness is **0.32 of 15**, two runs in two
thousand reach the watching phase, and the card fired **zero** times. The halves
pull apart because awareness is fed by successful robberies (+2 each) while
Tone's proof is fed by violence and defiance on the neighborhood channel, which
never reaches Curtis. With the clause dropped he recruits in 75 of 2,000 runs
across seven strategies. Feeding the awareness counter well enough to gate a
character behind it is its own build.

### Wage settlement

`settleCrewWages` runs at day end, dirty cash first, **highest loyalty first** —
so when the roll comes up short the arrears land on whoever trusts the player
least. A missed night accrues to `wageDue`; the first two are grace
(`CREW_WAGE_GRACE_DAYS`), every night after costs a loyalty point. At 0 the
member departs: assignments and block manager slots clear, and the record stays
(history matters) but stops counting toward capacity, power, wages, or presence
effects. `PAY_CREW` clears arrears mid-run.

**Deshawn's rent grace defers a miss by one day; it does not cancel the week
(v1.32).** While he is recruited and active the grace re-arms once per rent
period, which is what v1.15 designed and what his character is worth. What
changed is the effect: it used to stamp `obligations.lastMissedDueDay` and
cancel the whole period's miss, so one grace a week against one rent a week
meant **rent was never missed at all**. Inside a run that ended at day 10 that
was bounded — he ate at most one miss. v1.31 removed the day cap and the
boundary went with it; a measurement across fifteen strategies found eviction
unreachable in 100% of runs where Deshawn was active and reachable in 13–63%
where he was not. Now the grace clears the stamp instead of setting it, so the
nightly check re-fires the following night and the miss lands one day late —
and paying inside that day rolls `rentDueDay` past today, which is the day he
actually bought. **The deferral is derived from the absence of the stamp, so no
field was added and the schema stays v11.** The log line, which has always read
"the rent conversation waits one more day", is now accurate.

**The hazard class this belongs to.** Any mechanic whose cost was bounded by the
run ending became unbounded when v1.31 removed the cap. Deshawn's grace was the
first one found and is unlikely to be the last; PROJECT_STATUS carries the
v1.32 inventory of the others. When adding a per-period grant, ask what it costs
over forty days, not seven.

**And the hazard class that keeps hiding inside it: instrument coverage.** v1.33
worked the v1.32 inventory and found that two of its four Tier-1 items were not
engine problems at all. Heat is not a ratchet — the strategies shed roughly what
they gain through `LAY_LOW`, so the elective decay is real and used. Health was
not a one-way slide — `SLEEP_HOME` heals 12 for one slot and **the harness had
never dispatched it once**, which is why v1.32 wrote in this file that recovery
was "elective and mostly paid" and read the resulting deaths as an engine
property. Dre's note had never been borrowed at all. **Three systems in three
builds where "the engine is broken" turned out to be "the instrument never
exercised it."** Before tuning a constant, check that something in the harness
actually reaches the code that owns it.

**Dre's note has a ceiling (v1.33).** `LOAN_MAX_BALANCE_MULTIPLIER = 2` — the
balance stops at twice the principal. The late fee is 8% *of the balance* with a
collector multiplier on top and compounded daily, which inside a seven-day run
meant about three fees and a live decision; measured at forty days a $1,000
principal reached a mean of $12,700 and a worst case of $22,629. A debt nobody
can pay is not pressure, it is wallpaper. The cap is a ceiling and not a rate
change: below it the arithmetic is untouched, and the collector ladder — tier
escalation, the encounter, the daily Heat — is deliberately left alone, because
that is where the pressure is supposed to come from.

**`PAY_CREW` is not gated on the garage, and v1.30 removed the gate that said it
was.** Tone, Pherris and Deshawn recruit through Exposure scenes rather than
through the base, so a player could hold crew without ever holding a garage —
and the reducer required both `base.controlled` and `base.visiting`. That built
a trap with no exit: arrears accrued, two nights of grace ran out, a loyalty
point came off every night after, and the member walked, with the Pay button
disabled the entire time and the Bills row reading "Pay at the garage". The
garage is a prerequisite for territory (Eli, soldiers, claims) and never for
crew. `BAIL_CREW` and `PROMOTE_CREW_TIER` were already ungated on the same
reasoning; the wage path just joins them, and the Bills row now names People →
Crew. Two pre-existing quirks were left alone and are worth knowing: `PAY_CREW`
debits `player.cash` directly rather than through `spendCash`, and it does not
add to `crewMeta.totalWagesPaid`, so the lifetime counter undercounts arrears
cleared by hand.

### Presence effects

### The Made Men modifier triangle (v1.20)

Presence effects change how an **event** resolves. The triangle changes how the
**territory** performs. Each lieutenant owns exactly one number on the guard
layer, and the three map onto the three attributes:

```
Tone (Combat)          → Defense strength multiplier on stationed soldiers
Pherris (Intelligence) → Block intel visibility tiers
Deshawn (Charisma)     → Territory heat trickle reduction
```

| Who | Table | Tier 1 / 2 / 3 | Read by |
|---|---|---|---|
| Tone | `TONE_DEFENSE_MULTIPLIER` | 1.15 / 1.30 / 1.50 | `resolveSoldierOperations` |
| Pherris | `blockIntelLevel()` | level 1 / 2 / 3 | `blockIntelView()`, the Territory cards |
| Deshawn | `DESHAWN_HEAT_REDUCTION` | 0.80 / 0.60 / 0.40 | `territoryHeatChance()` |

The attribute connection is **thematic, not mechanical**: a player with high
Combat recruited Tone because combat observations fed his lens, but the player's
own attributes do not scale the lieutenant's number. That is a future build.

Three rules hold the triangle together:

- **Modifiers, never a parallel roster.** A tier is scope of responsibility, not
  headcount. Tone does not add soldiers — he makes the posted ones worth more.
  One soldier under a tier-2 Tone defends as well as 1.3 without him, and the
  headcount that frees up is the actual reward.
- **Derived, never stored.** All three are computed from the crew record the
  save already carries (`Crew.modifierTier` → recruited, `status === "active"`,
  loyalty above 0, tier clamped 1-3), so **the schema stays at v11** and an
  effect disappears the same night its owner is arrested, departs, or stops
  showing up. Pherris's level is deliberately a derived selector: later builds
  add intel *sources* on the same ladder, and a cached level would need
  invalidating by every one of them. v1.27's disclosure tables are the first of
  those sources and they landed **beside** her ladder rather than on it — they
  are on-demand purchases gated by band, hers is a standing feed gated by tier —
  so `blockIntelLevel()` is unchanged and her cards are untouched.
- **One seam each.** Defense enters the raid math at one expression, the heat
  trickle at one roll, the intel ladder at one selector.

`Crew.modifierTier` draws the same line `presenceEffectsFor` does, loyalty 0
included: they are on the roster and doing nothing, which is what the number
means.

### Presence effects

`PRESENCE_EFFECTS` is what an active member changes about event resolution just
by being on the payroll. Checked at **choice-build time** (the encounter
selectors and card builders), not at render time, so the reducer and the UI
agree about which choices exist. Three modifications are authored, and as of
v1.19 each has a live caller:

| Modification | Who | What it does | Reader |
|---|---|---|---|
| `de_escalate` | Deshawn | adds the "let him handle it" choice | `deEscalateAvailable()` |
| `combat_advantage` | Tone | +1 effective Combat on the roll | `combatAdvantageFor()` |
| `intel_advantage` | Pherris | +1 effective Intelligence on market reads | `intelAdvantageFor()` |

Deshawn's de-escalation excludes `CURTIS_CREW_ENCOUNTER_IDS` — Curtis's own
people pay him no respect at tier 1 — and so does Tone's combat edge, for the
different reason that they knew him when he worked their side of it. Pherris
excludes nothing: a contact list does not care whose corner the deal is on. Every
advantage is an **effective attribute level passed as the trailing `bonus` to
`resolveAction`**, never a chance bump, and every one is capped at 1: a second
person is a second wage, not a second bonus.

`intel_advantage` reaches two call sites — the `market_meetup` roll in game-core
and `priceVolatility` in `src/events/market-events.js`. The second is why
`market-events.js` requires `src/data/crew.js`; that edge is legal (neither file
reaches game-core) and adds no cycle.

**`de_escalate` was declared in v1.15 and read by nobody until v1.19.** All three
sites that offered Deshawn's choice rebuilt the predicate inline instead. Routing
them through the framework closed that, and tightened one thing in passing: the
inline checks tested `status !== "departed"` while `getActiveCrew` tests
`status === "active"`, so an **arrested** member no longer supplies a presence
effect from a cell. `tests/v1-19.test.js` asserts that nothing in
`PRESENCE_EFFECTS` is dead again.

### Eli, soldiers, and blocks

Soldiers exist only once **Eli is Operations Lieutenant** (`eliLieutenantActive`,
gated on loyalty 8). Capacity is `2 + 2 * controlledBlocks`, at most 3 per block;
recruiting costs $140, discounted 25% when Deshawn is tier 2 or better.
`resolveSoldierOperations` is the nightly organization pass, called from
`advanceRun` on a crossed day. Per player-owned block, in order:

1. **Auto-assignment.** Eli redistributes unassigned soldiers per his standing
   order (`ELI_OPERATION_POLICIES`: balanced, maximize_income, hold_ground,
   stay_quiet, manual). Switching policy costs no player time.
2. **Income.** Each assigned soldier earns the block's `earningPotential`, the
   second and third diminished by `0.85^index`. Paid as dirty cash.
3. **Two adversaries, two rolls (v1.21).** See "The raid split" below. Police
   first on staffed corners, then Curtis on every corner the player holds.
4. **Attrition.** An idle-loss roll per soldier, `0.05 - eliEffectiveness * 0.01`.
   Skipped on a corner Curtis just took — there is nobody left on it.
5. **Territory heat.** One roll for the whole operation, after the blocks
   resolve: `sum(heatExposure of held blocks) * 0.06 * deshawnReduction`, capped
   at 0.9, for +1 Heat. Ownership is what costs attention, not staffing — an
   empty corner you hold still counts. **This is the only territory heat path**
   (`territoryHeatChance`, exported as a selector so the UI can show the player
   the same number the night rolls against), and a player holding nothing never
   rolls it, which is why Deshawn is worth nothing to them.

The pass reports as one "Eli's report" feed line per crossed day, plus one phone
text per adversary and one consequence card when a corner is lost. Block losses
are the one thing that still gets its own feed line.

### The raid split (v1.21)

Before v1.21 a single blended roll decided both "the police busted your corner"
and "Curtis took your corner". That meant Heat quietly governed how much
territory the player kept, a player who went quiet still lost corners at the
same rate, and `curtisVisibility` — the stat describing how exposed a block is
to Curtis's network — had no offense-side reader at all. They are two events
now, resolved in sequence inside the same `resolveSoldierOperations`. There is
no second nightly function.

| | Police raid | Curtis move |
|---|---|---|
| Reads | player Heat, `patrolFrequency`, Eli | `curtisVisibility`, awareness phase, **player Heat above 8** (v1.28) |
| Ignores | `curtisVisibility` | `patrolFrequency`, Eli |
| Runs on | **staffed** corners only | **every** corner the player holds |
| Chance | `POLICE_BASE_CHANCE + heat * POLICE_HEAT_WEIGHT + patrol * POLICE_PATROL_WEIGHT - eli * POLICE_ELI_DISCOUNT`, capped 0.9 | `CURTIS_BASE_CHANCE * (visibility * CURTIS_VISIBILITY_WEIGHT) * CURTIS_PHASE_MULTIPLIER[phase] * heatFactor / defense` |
| Heat | **+1** | **none** — he is not the police |
| Ownership | **never changes** | **flips to `curtis`** |
| Observation | `heat_exposure / police_raid` on `neighborhood` | `defiance / block_lost_to_curtis` on `network` |
| Counter | `record.raidCount` | the owner flip itself |

Constants live in **`src/data/territory.js`**, which requires nothing (the
one-way rule: data into logic, never back). Both gates are hashed rather than
drawn: `stringHash(seed:raid:blockId:day:police|curtis)`, which is what lets a
second pass exist without shifting the tick's RNG stream, and what makes a
reloaded save replay the night instead of rerolling it. The roll is fixed; the
threshold is live, and that is where the player's agency sits.

**Phase-gated visibility.** `CURTIS_PHASE_VISIBILITY_GATE` is the minimum
`curtisVisibility` a block needs to be on his map at all. Below it he does not
come, at any odds.

| Phase | Gate | What he can see |
|---|---|---|
| `invisible` | 99 | nothing — he is not looking |
| `ambient` | 2 | Fourth Avenue Strip, Motel Row, Service Road Chokepoint |
| `watching` | 1 | those plus Wash & Go Lot and Minnesota Off-Ramp |
| `approaching` | 0 | everything with visibility above zero |

**Spenard Rec Center Lot is never his, at any phase.** Its `curtisVisibility` is
0, so the multiplier zeroes the chance even at `approaching` where the gate lets
it through. The police still raid it. This is a deliberate design position — the
quiet lot nobody's network carries news about is the safe, low-earning corner —
not an emergent accident.

**How the Made Men map onto the two.** Tone divides both: on the police side
through the shared casualty roll (`takeRaidCasualty`), on Curtis's side as a
divisor on whether he comes at all. Eli discounts the **police roll only** — he
manages an operation against the police, not a war with Curtis. Deshawn touches
neither directly; his heat reduction keeps Heat lower, which lowers the police
chance, and that interaction is emergent and correct.

**Headcount still protects the corner.** Curtis's divisor is
`(posted > 0 ? posted * RAID_DEFENSE_PER_SOLDIER : CURTIS_UNSTAFFED_DEFENSE) * tone`,
which keeps v1.20's promise that a second posted soldier halves the chance of
losing the block. Claiming without defending is not free.

**v1.28 fixed the floor, and it mattered more than it looks.** The divisor used
to be `max(1, soldiersAssigned.length)`, which made an **empty** corner and a
**one-soldier** corner arithmetically identical — so posting your first person on
a corner bought nothing at all, and this file's own claim that an undefended
corner "costs double" was only ever true against the two-soldier case.
`CURTIS_UNSTAFFED_DEFENSE` is 0.5: nobody standing there is half a defender, so
the first body halves the chance exactly like the second does. **This is where
"probe the weakest" lives** — the resolver already rolls every corner
independently, so there is no ordering to tie-break, only a number that has to
reward him for reading the gap.

**It also couples the two adversaries, and that is a real consequence rather than
a side effect.** The police empty a corner; an emptied corner is the cheap one to
walk onto. Measured at `watching`, the most-flipped corner is now Service Road
Chokepoint (patrol 3) rather than Northern Lights Motel Row (visibility 3) —
0.053 against 0.055 per block-night, with the chokepoint ahead on total loss
rate. He still does not read patrol routes; the coupling runs entirely through
who is standing on the corner. v1.21 asserted the split by proxy ("the
most-hunted and most-raided corners are different ones") and that proxy is gone.
The split is still real where it was always defined: **the police never change
ownership, and Curtis never touches Heat.** Those two are pinned directly.

**He reads Heat above 8 (v1.28).** `curtisHeatFactor(state)` is
`1 + max(0, heat - CURTIS_HEAT_PROBE_FLOOR) * CURTIS_HEAT_PROBE_PER_POINT` — 1.0
at or below Heat 8, 1.20 at 12, 1.35 at 15 — and it multiplies into
`curtisMoveChance`. **This is not coordination.** He has no line to the police
and no plan that involves them; a hot player is one whose soldiers keep getting
arrested, and a thin corner is an easy corner. He gets luckier when you are hot
without ever having decided to. It multiplies a threshold that is already
compared against a hashed gate, so there is **no new draw and no new hash**. It
is deliberately not in `curtisNightPlan`: a warning that got quieter because the
player's Heat dropped would be reporting the odds rather than the man.

**`curtisVisibility` now has two readers**: `eliPolicyBlockScore`'s `hold_ground`
weight (defensive placement) and `curtisMoveChance` (his targeting). Both are
exported as selectors — `policeRaidChance` and `curtisMoveChance` — the same way
`territoryHeatChance` is, so a Territory screen can show the player the same
numbers the night rolls against, per adversary.

**Block intel.** `blockIntelLevel(state)` in `src/selectors.js` replaced the
`flags.spenardBlocksRevealed` boolean with a ladder: without Pherris the flag
still reads as level 1, with her it is her tier. Level 1 is the map (ownership
plus the numbers a scout copies off a clipboard), level 2 adds soldier counts on
your corners and a **±1 estimate** of what Curtis has on his, level 3 makes that
exact and adds his last move and which of your corners he is lining up
(`curtisBlockTargets`, depth gated by his awareness phase). The estimate's
jitter is hashed from `seed:block-intel:blockId:day` — deterministic, so a
reload never rerolls it. `blockIntelVisible()` survives as `level >= 1` for the
callers that only ask whether the map is readable at all.

`src/selectors.js` needs the hash and `src/events/random.js` needs
`slotNumber()` from the selectors, so v1.20 moved `stringHash` into
**`src/hash.js`** — a leaf module that requires nothing. `random.js` re-exports
it, so every existing `require("./events/random.js").stringHash` call site is
unchanged.

### The nightly plan (v1.23)

`curtisNightPlan(state)` in `src/selectors.js` is **the** answer to "which of
your corners are his people working, and how hard". It is a pure read — nothing
stored, no draw off the RNG stream — so the same day, phase and holdings return
the same plan every time, which is what lets a warning be raised the night before
and re-derived when the day arrives.

```
[{ blockId, name, weight }]   weight 2 = coming hard, 1 = just looking
```

Ranked by **the grudge** (v1.28), then `curtisVisibility`, then
`earningPotential`, then id (`compareBlocksByCurtisPriority`, exported because
the gossip surface has to reproduce the order without holding the plan). Cut to
`CURTIS_TARGET_DEPTH_BY_PHASE`, then `CURTIS_PRESSURE_BUDGET_BY_PHASE` is spent
greedily down the list, capped at `CURTIS_MAX_PRESSURE_PER_BLOCK`:

| Phase | Depth | Budget | Allocation |
|---|---|---|---|
| `invisible` | 0 | 0 | — |
| `ambient` | 1 | 1 | `[1]` |
| `watching` | 2 | 3 | `[2, 1]` |
| `approaching` | 3 | 5 | `[2, 2, 1]` |

**It does not read the garrison.** The plan is his intent; what the player posts
in response is the thing a warning exists to let them change. And it **does not**
feed `curtisMoveChance` — what he intends and what the night rolls are separate
on purpose, so a warning is information rather than a promise.

**v1.28 was asked to put "probe the weakest" in here and deliberately did not.**
A planner that read soldier counts would change the instant a warned player moved
somebody onto the warned corner, so the warning would falsify itself and the
re-derivability above would go with it. He probes the weakest at resolution,
through the defense divisor, where the odds already live.

**The grudge (v1.28).** `record.curtisTookBack` is stamped by the resolver the
first time he takes a corner back off the player, never cleared, and boolean and
additive so `mergeDefaults` hydrates every older save to `false`. A corner
carrying it outranks everything else — he wants his shit back. Note what it is
**not** keyed on: every corner on the map starts `owner: "curtis"`, so "a corner
the player took from him" describes all six and would rank nothing. A corner he
has already come back for is the one with a history.

**The bank (v1.28).** Pressure the plan could not spend — which only happens when
he holds more budget than there are corners on his board — carries to tomorrow in
`run.curtisPressureBank = { phase, points }`, capped at
`CURTIS_PRESSURE_BANK_CAP` (2) and dropped when the phase moves. Session state on
`run`, object-shaped, hydrated free: **the schema stays v11.**

Two rules about it, both load-bearing:

- **The plan reads it; the resolver writes it.** `curtisPressureLeftover` is the
  read the resolver settles with, so the planner stays pure.
- **It is settled BEFORE the warnings are raised**, in the day-end pass. That
  ordering is the whole correctness argument: a warning raised tonight has to
  name the plan the player re-derives tomorrow, so nothing feeding the plan may
  move between the two. Writing the carry afterwards would telegraph one plan and
  resolve a different one — exactly the v1.23 bug the plan exists to prevent.

**The bank cannot change a loss rate, and that was measured rather than assumed.**
The budget feeds the pressure *weight*; the weight is not an input to
`curtisMoveChance`; and the resolver never consults the plan at all — it rolls
every held corner independently. So the bank and the grudge move what the gossip
surface, Pherris's level-3 read and the paid disclosures **say**, and nothing
else. At `watching` the loss rate with them and without them is identical.

**`curtisBlockTargets` is now the plan, flattened**, which closes the v1.21
disagreement filed against it. The old list only *ranked*: it applied no phase
visibility gate and did not exclude visibility-0 corners, so at `ambient` Pherris
would name the Minnesota Off-Ramp as next while `curtisMoveChance` returned a
flat zero for it, and at `approaching` she named the Spenard Rec Center Lot — a
corner he never comes for at any phase. One list, gated by exactly what the night
is gated by, so what she reports and what he does cannot drift.

### Gossip warnings (v1.23)

The Exposure system's **return path**. Observations have always flowed from the
player into ledgers; here the block knows something the player wants, and whether
it reaches them is a relationship question.

1. The day-end pass calls `emitCurtisGossipWarnings` after
   `resolveSoldierOperations` (ownership settled), `settleCurtisNight` (phase
   settled) and `resolveCrewTracks` (payroll settled) — the first point where
   every input to **tomorrow night's** plan is final. A warning that lands after
   the corner changed hands is not a warning, which is why it is raised for the
   next night rather than the one just resolved.
2. One `territory / curtis_move_planned` observation per targeted corner, with
   `location` set to the **block id** and `value` to the pressure weight, queued
   straight onto `run.pendingObservations` at a slot this pass computed.
   `Exposure.queueObservation` exists for exactly this: `broadcastObservation` is
   right when the question is "who could have picked this up" and wrong when the
   caller already knows, and the neighborhood channel's one-to-two-day jitter
   would deliver a third of these after the corner was gone.
3. The queue drains at Morning of the attack day (`drainObservations`, the single
   call site — every former `Exposure.resolveObservationQueue` caller now goes
   through it), and its `onDeliver` hook hands game-core the rows that landed.
   The engine learns nothing about phones.
4. Among the NPCs who heard it, the **highest disposition at Warm or above**
   sends one phone text naming the corner. Ties break on
   `stringHash(seed:warn-npc:blockId:day:npcId)`.

**Curtis never sees it, by two independent rules**: he is not on the
`neighborhood` channel, and `territory` does not clear his network filter either.

**The silence is the mechanic.** There is no negative branch anywhere in the
delivery path — an NPC below Warm is simply not in the candidate set. A player
with no warm neighborhood relationships meets him cold, which is the first place
in the game where the social layer pays a tactical dividend. An **empty ledger
can never speak**, asserted explicitly so no future default can grant a voice to
someone nobody has ever observed.

**Deshawn is reach and timing, never the plan.** Read through
`Crew.modifierTier` (departed, arrested, never recruited and loyalty-0 all read
0, so the bonus disappears the moment he does):

| Tier | What changes |
|---|---|
| none | the plan's **top target only**, morning of |
| 1 | **every** corner on the plan |
| 2 | + the pressure weight in the text ("coming hard" / "just looking") |
| 3 | + it arrives the **evening before** rather than the morning of |

He does not deliver it himself unless he happens to be the closest person. His
network hears earlier and wider; whoever the player is closest to says it.

**Police raids get the reactive half only.** A raid raises a second,
corner-scoped `territory / police_swept_corner` observation beside v1.21's
district-scoped `heat_exposure / police_raid` (which is untouched, and still
carries the disposition consequence). It cannot be one row: `location` has to be
a district for `couldObserve` to route it, and has to be a block for the text to
name a corner. There is deliberately **no predictive police warning** — the
police answer Heat, which can move at any time.

**Two surfaces, not one.** Pherris's level-3 block card is the standing strategic
read ("these corners are at risk", Territory page, always visible); the gossip
text is the event-driven complement ("they're coming tonight", Phone, morning
of). They can overlap — if Pherris is the closest person she sends the text *and*
her intel stays on the card — and the Territory page renders no gossip copy.

**One voice, one text a day**, tracked in `run.gossipVoices` (`{ day, npcIds }`,
session-only, reset lazily on the first delivery of a new day, hydrated
additively so a save predating it loads). When more corners are warned than there
are people willing to call, the corner that gets said out loud is the one he
wants most, not the first one alphabetically.

### Disclosure tables (v1.27)

Gossip is the block calling you. Disclosure is you calling the block. Same
underlying facts, opposite direction, and the differences are the design.

| | Pherris (v1.20) | Gossip (v1.23) | Disclosure (v1.27) |
|---|---|---|---|
| Costs | crew wage | nothing | cash, per ask |
| Timing | standing | when the block decides | when the player asks |
| Gate | her crew tier | disposition ≥ Warm | **band**, per row |
| Failure mode | lower tier, less detail | silence | not on the menu |
| Surface | Territory block cards | Phone texts | Phone → Contacts → Ask about… |

**The table is `src/data/disclosures.js`** — `{ npcId, intelType, minBand }`,
seven rows over five intel types. Like `gossip.js` it is pure: no state read, no
`game-core.js` import, voices and jitter math only. That boundary is load-bearing
rather than decorative, because `policeRaidChance` and `curtisMoveChance` are
closures inside game-core. The caller gathers the truth; this module shapes it
and speaks it. Each intel type carries a `reads` field naming the selector it
derives from, which is documentation a test executes — a type cannot claim to
read something the game does not compute.

**Every row is justified by the seller's own channel**, checked against
`propagation.js` by test rather than by assertion. The two people who can name
Curtis's targets (Dre, Mina) are on `network`, the only channel his people's
movements travel. The three who read the street (Juan, Yalonda, Biniam) are on
`neighborhood`, because a cruiser going past three times is something you see
from a window. **Deshawn is absent and stays absent** — his whole value is being
off Curtis's network, and a man who is not on the wire cannot sell what is on it.
He shapes what *other* people say (the v1.23 tier ladder) and never becomes a
source. **Pherris is absent** because her intel is a subscription she already
sells; a disclosure row would charge the player twice for it. **Selam is absent
and v1.30 wrote the reason into the file**: she has never been written speaking
about territory or criminal operations, and a line to fill a table would be the
wrong character. Authored register first, table row second. Phase 3.2 named her
as an obvious candidate without checking whether there was a voice to give her;
there is not, and writing one is a character build rather than a table build.

**Tone is the sixth product and the first crew source (v1.30).**
`territory_status`, $40, gated at Warm **and** on him being recruited and
active. It is the only row that is not about Curtis: it reads the player's own
corners back to them — headcount, whether the police came through last night,
whether the corner lost somebody, all of it already in the feed and already
scrolled past. Two rules bend for it, both deliberately. The row carries
`requiresCrew`, the only field the game reads out of state rather than out of
`disclosures.js`, and the check lives in `disclosureOffers` and the reducer
because the module may not read state. And it is **authored `exact` only**:
`resolvedAccuracy` upgrades the at-gate `jittered` to `exact` when no jittered
voice exists, so the absence of the branch is the design statement. A man
miscounting his own people on your own corners would be a bug, not a texture.
His channel is `direct` — he walked them.

**Answering "which corner lost a man" needed one new field.** `takeRaidCasualty`
nulled the soldier's `blockId` and stamped nothing, and the per-night counts were
function-locals that went into the feed as text and were discarded, so the
morning after, the question was unanswerable. `territoryBlocks[*].lastCasualtyDay`
is set in both loss paths (raid and attrition). Additive, `null` by default,
`undefined` on an older save never equals yesterday — **schema stays v11**.

**Accuracy is the band.** `accuracyFor(band, minBand)` returns `unavailable`
below the gate, `jittered` at it, and `exact` above it — or at Bonded, which is
the ceiling. That last clause is the same rule `blockIntelView` has followed
since v1.20 (jittered below the top level, exact at it); without it
`curtis_next_move`, whose gate *is* Bonded, would be the most expensive product
in the game and the only one that always lies a little. Numeric reads jitter
±15%, list reads are faithful / omit one / add one false positive drawn from
corners the player actually holds, and a pressure weight moves at most one step
and stays inside the range Curtis could have assigned — being wrong is fine,
being impossible is a bug the player can detect.

**All jitter is `stringHash`, never an RNG draw**, keyed
`seed:disclosure:npcId:intelType:day` on the model of
`curtisBlockDefenseEstimate`. Two reasons, both load-bearing. A reload must not
reroll what somebody already told you — the message is sitting in the inbox.
And a purchase must not move the RNG stream, or intel would become a *cause* of
the night it describes rather than a view of it.

**Staleness is implemented by the absence of code.** A disclosure is cached as a
phone message at the moment of purchase and never re-derived. Buy the plan in
the Morning and you get the Morning's plan; if his awareness phase moves before
dark, what you were told is out of date and stays out of date, because the
source is not going to call back with a correction.

**`BUY_DISCLOSURE` is a phone interaction, not a location visit** — absent from
`TIME_ACTIONS`, no `advanceRun`, no district gate, so it costs money and nothing
else. Same shape as `PAY_RENT` and `PAY_PHONE_BILL`. **One call per person per
day**, tracked in `run.disclosures` (`{ day, entries }`, session-only, reset
lazily on read, hydrated additively) — the same pattern and the same reasoning
as `run.gossipVoices`, and the reason the save schema stays at v11. The cooldown
is on the *person*, which is also what makes buying the same intel twice a
no-op: the first answer is already in the inbox.

## Territory: two layers

Independent and additive. Conflating them is the easiest mistake to make here.

| | District layer | Block layer |
|---|---|---|
| Data | `TERRITORIES` in `src/data/locations.js` | `SPENARD_BLOCKS`, same file |
| State | `world.territories[areaId]` | `world.territoryBlocks[blockId]` |
| Scope | a whole neighborhood | one corner inside a neighborhood |
| Coverage | all three districts | Spenard only (`districtHasBlockLayer`) |
| Taken by | `TAKEOVER` — crew power vs. a defender score | `CLAIM_BLOCK` — cash plus a spare soldier |
| Pays | flat `dailyIncome` | per-soldier, in `resolveSoldierOperations` |

**Block ids are globally unique** (`spenard_rec_lot`, not `rec_lot`), so downtown
and industrial blocks can be added later with no schema change. `CLAIM_BLOCK`
**is** a live reducer action: it requires the garage, an available block, the
cash, and at least one **unassigned soldier** — who posts up immediately — then
writes a `submission / claimed_block` row to Curtis, flags
`hustle.exposure.networkEscalation`, and spends one part of day.

**The first claim branches (v1.24).** `controlledBlockCount(state) === 0`, read
*before* the ownership write, gates four things that fire once per run and never
again: a titled consequence card, a same-day phone text from Deshawn (or "Word
Around Town" when he is not on the roster), its own feed line, and one
`growth / first_territory` observation on the **neighborhood** channel. Nothing
is stored for it — the board already knows how many corners the player holds, so
the save schema did not move. Claims 2-6 keep the generic line, which is correct:
only the first one is a beginning.

That observation is located at `HOME_DISTRICT_ID` and **not** at the block id,
and the reason generalises to every neighborhood broadcast: the channel sets
`presence: true`, so `couldObserve` compares `location` against
`NPC_PRESENCE_AREAS`, which holds **district** ids only. A block id there matches
no NPC and the row lands in zero ledgers. v1.23 hit the same wall from the other
side and had to split one row into two. **If a corner needs naming, name it in
the copy, not in the `location`.** `tests/v1-24.test.js` asserts no NPC has a
block-level presence area, so this fails loudly next time.

**Double-pay guard.** The crossed-day territory income in `applyPressure` skips
any district that has a block layer, because soldier income already pays per
block there. Removing that guard pays Spenard twice.

Three selectors, all exported through `C.selectors`. **`districtControlTier`**
is the player-facing District Control read: where an area has blocks the tier
follows how many are held (Neutral 0, Presence 1, Influence 3, Dominant 4) plus
a capstone at all six blocks *and* Curtis at Trusted; areas with no block layer
fall back to the owner boolean. **`territoryPowerEstimate`** is the defender's
strength as the player gets to see it — Intelligence buys precision, not power:
exact at 3+, ±1 at 2, ±3 below. **`blockIntelVisible`** decides whether real
block stats show at all; until Eli's map reveals them the UI prints "Numbers
unconfirmed" instead of earning potential, heat exposure, and patrol frequency.

## Economy philosophy

**The design position, and it is not negotiable by measurement.**

> The legal path is the **highest expected-value outcome**. Criminal income is
> higher per-action but lower in expectation after costs. Each new district,
> product tier, or scale level increases both the **ceiling and the floor** of
> criminal income proportionally, preserving this relationship.

Said plainly: crime is faster, riskier, and worse in expectation. Smart crime
**approaches** the job's net return after Heat, arrests, crew wages, territory
attrition and inventory loss, and does not beat it. The hustle is seductive and
the hustle is a lie. That is the game's thesis, and the economy is the argument
for it — so a balance change is wrong if it makes the criminal path the sensible
one, however good the numbers look in isolation.

**The scaling rule.** Every district, tier or scale level added from here widens
the criminal distribution in *both* directions — more volume and more exposure,
a higher best case and a worse worst case — while the legal path stays flat.
5.2 Downtown is the first test of this: it is currently the sell side of the
only profitable trade in the game, so adding it must raise ambient heat, wage
load and loss exposure in step with the dirty-cash volume it unlocks. A district
that only raises the ceiling breaks the thesis.

### Where the economy actually stands (v1.34, 8 runs per profile, 40-day horizon)

Net worth against `legal_worker` at 1,169 = 100%:

| profile | netWorth | vs job | what it does |
|---|---|---|---|
| `hustler` | 1,281 | **110%** | job **plus** the arbitrage route |
| `flipper` | 352 | 30% | 907List only |
| `stickup` | 281 | 24% | armed robbery |
| `worker` | 204 | 17% | job plus 907List |
| `arbitrage` | 197 | 17% | the route, no job |
| `territory` | 150 | 13% | the whole block layer |
| `trader` | 30 | 3% | buy-cheapest-here, the old rule |

Both of the design position's out-of-band conditions fire at once, which is the
finding this build exists to have produced:

- **Pure crime is at 17%, below the 50% "the route is dead" floor** — and *not*
  because the margin is bad. The margin is **+17% to +24%**, against `trader`'s
  **−13%**. A courier who can only ever afford four units of a ten-unit load
  earns four units of profit. The binding constraint is the **capital curve**,
  not price.
- **Crime alongside the job is at 110%, above the "costs are too low" ceiling** —
  the hybrid beats the pure job, which the position says it must not.

Those two point at the same missing thing, and it is a mechanic rather than a
number.

### In-market spreads are non-positive by design

Buy and sell prices in the same market never round-trip for a real margin. Across
6 seeds × 5 days × 3 products in every market, the widest in-market spread
observed is **+1.9%**, and that is integer rounding (buy 54, sell 55) rather than
a margin. **All trading profit is arbitrage between districts**, and the route is
large: **+45% to +76%** mean across weed, shrooms and cocaine, never negative on
the best available pair.

This is why the fourteen pre-v1.34 strategies realised **−6% to −22%** on the
trade. `simulate-runs.js` sorted buy candidates by `price` *in the current
market*, with no model of where the load would be sold, so a bot buying Downtown
weed at 43 to sell at North Star for 23 was running the arbitrage backwards.

Two consequences worth writing down so they are not rediscovered:

- **A courier who buys single fares is paying to work.** The week pass is $45
  once against roughly $470 a run in singles; without it the route measures as
  dead when it is not.
- **Never judge trading on netWorth alone.** Unsold inventory counts toward net
  worth, so raising the sell threshold makes netWorth *rise* while the trade gets
  worse — 1.05 → 2.00 on `trader` moves margin −11% → −86% and netWorth 40 → 171.
  Report margin and net trade alongside it, always.

### The Heat gap on the trading path (open, v1.35)

`SELL` has **no Heat term at all**. `BUY` has one, but it is
`floor(product.heat * qty / 5)` and the two open-access products carry
`heat: 0` — measured across four seeds of three trading profiles, **383
purchases and 521 units produced exactly 0 Heat**. Forty days of couriering
product across the city reads to the police like forty days at the Chevron,
which is precisely why the hybrid is free money.

**This build did not fix it**, deliberately: there is no measured basis for
choosing a rate, and picking one would be tuning ahead of the measurement. The
rule that produced this section is the one to keep — *assume the economy is fine
until proven otherwise, and do not tune prices, margins or product costs until
the instrument has played the game competently*. Four builds running, "the
engine is broken" has meant "the instrument never exercised it": rent (14 of 15
never paid), rest (15 of 15 never slept), Dre's note (15 of 15 never borrowed),
and now arbitrage (18 of 18 never traded cross-market).

## The criminal economy

Tracks that share one geography layer (`src/data/districts.js`). Every track
reads the same two per-district numbers: a **difficulty nudge** (`diffMod`, one
step = 0.08 of success chance) and a **heat multiplier**, applied before the
0-15 clamp.

| District | Market | Boost | Stick |
|---|---|---|---|
| Spenard | −1 diff, ×0.8 heat | 0, ×0.9 | **+1**, ×1.3 |
| Downtown | +1, ×1.2 | −1, ×1.1 | −1, ×1.0 |
| Industrial | 0, ×1.1 | +1, ×1.2 | −1, ×1.2 |

`fairview` and `mountain_view` carry rows so the data shape is final before those
districts ship — **(schema planted, not active)**; nothing references them at
runtime until they join `NEIGHBORHOODS`.

**Stick** (`state.stick`) is the robbery ladder: tier 1 street work, tier 2 named
registers behind a weapon gate (rep 4), tier 3 organized work behind rep 10 plus
a weapon. Casing adds +0.06 chance, twice at most; two robberies a day across
every surface; a landed job queues a seeded retaliation card two mornings later.
`stickTier()` derives the tier and `stick.tier` is a save mirror.

**Boost** (`state.boost`) is the theft ladder, gated on `technique` (5 for tier 2;
13 plus a field-assignable crew member for tier 3) rather than rep. Getting caught
opens a fight / run / surrender encounter, with the target and take parked in
`boost.pendingCaught` until it settles. **Slide Okafor** is the fence, and the only
one — a storage unit off Tudor Road, strictly transactional. `FENCE_BOOST_GOODS`
pays at a rate driven by `boost.fenceStanding` (0-5) and broadcasts
`financial / fence_sale` on `household`.

**Plug suspicion** (`plugs.records[*].suspicion`) is how the supply side notices
robbery. Any robbery on a plug's home block raises it by 1 (+2, and −3 standing
across all plugs, when that plug is robbed directly). At 3 they add a 10%
premium, at 5 they stop selling; a clean purchase or a quiet day works it down one.

**Awareness bleed** (`criminalProfile`) is how a district remembers. Each action
adds 1 to that district's count for that track, every 3 points is one difficulty
step there, and neighbors on `DISTRICT_ADJACENCY` receive half strength a day
later through `bleedPending`. That graph exists **only** for bleed — travel
remains flat any-to-any.

## Arrest and jail

`arrestPlayer` is the single funnel every arrest goes through; numbers live in
`src/data/arrest.js`, the state write in `game-core.js`. The trade it makes:
**bail and clock in exchange for heat relief and a permanent record**. Without
that release valve an arrest is pure loss and reads as a bad roll, not a system.

| Severity | Bail | Processing | Heat relief | Crew bail | Crew days |
|---|---|---|---|---|---|
| `boost1` | $150 | 1 slot | −2 | $200 | 1 |
| `boost2` | $250 | 1 | −2 | $300 | 1 |
| `stick1` | $350 | 2 | −3 | $400 | 2 |
| `stick2` | $600 | 2 | −4 | $650 | 3 |
| `stick3` | $1000 | 3 | −5 | $900 | 5 |
| `encounter` | $300 | 2 | −3 | $350 | 2 |

Priors multiply bail by `[1, 1.5, 2, 2.75, 3.5]` (indexed by arrests already on
the record, topping out rather than spiralling) and add one processing slot per
two priors, all capped at `MAX_PROCESSING_SLOTS = 4`, a whole day. **Nobody
soft-locks on bail**: a player who cannot pay has the shortfall converted to time
at $150 per part of day. Heat relief is priced so a cheap offense cannot become a
heat dump — a stickup player at heat 12 caught on a tier 1 job still walks out
at 9. `arrestPlayer` **does not move the clock itself**: it returns
`processingSlots`, and the call site feeds that to the one `advanceRun` it was
already going to make, so the one-advance-per-action contract stays intact.

**Crew arrests.** `jailCrewMember` sets `status: "arrested"`, which is what pulls
them out of capacity, power, wages, and field assignment. Bailing them out early
costs 1 loyalty (the arrest shook them, but you showed up); serving the whole
stretch drops them to loyalty 1, one missed wage from walking.
`releaseServedCrew` also repairs the older bug where an arrested member with no
release date had no way back at all.

## Reputation is not a stat

There is no global reputation stat and there will not be one — an open ticket
from an earlier system audit, closed as a design decision. What people mean by
"reputation" is already three things modelled better separately: **NPC
dispositions** (what specific people think, derived from what they saw — one
number would flatten Curtis reading you as no problem and Mina reading you as
safe into the same value, when those are opposite facts), **Intelligence** (a
capability, not an opinion anyone holds about you), and the **existing pricing
signals** (district influence, territory control, plug standing, Broker
verification). A scalar on top would duplicate or contradict them. Do not add a
`reputation` field to `state.player`, and do not write comments promising one.

## System connections

Line numbers are `game-core.js` unless noted, and they drift.

| Connection | State | Evidence |
|---|---|---|
| Phone off → missed events | **Wired** | `pushPhoneMessage` only delivers when `phone.active` (:463); job callbacks stall (:472); story cards gate on it (:3003, :3011, :3013); unpaid bill cuts service (:2706) |
| Yalonda trust → housing | **Wired** | rent due (:4463); `householdWarning` accumulates (:3333); 3 warnings ⇒ `evicted` + `endRun` (:3336) ⇒ `nowhere_to_go` ending (:3303) |
| Juan trust → lead quality | **Wired** | `juanWorkIntelKnown` (:1752) unlocks the `ship_creek` job (:1913); trust gates the Dre route (:2418) and two story cards (:3003, :3011) |
| Consequence cards → phone / day log | **Wired** | `logEntry` (:452), `pushConsequence` (:456), `pushPhoneMessage` (:461). `pushConsequence(state, text, tone, title)` — the fourth argument is optional and additive (v1.24); untitled cards, including ones queued in an older save, render exactly as before. Reserve the heading for ceremony beats: a heading on a one-line card is noise |
| Heat → encounter frequency | **Wired, not via weightedPick** | ambient chance carries `+ heat * 0.01` (:3156); police/rival cards gate on heat (:3033 `heat >= 5`, :2933 `heat >= 10`); block raids scale with `RAID_HEAT_WEIGHT` (:2607). Heat is **not** a term in `getWeight` |
| Reputation → vendor pricing | **Closed as a design decision** | see *Reputation is not a stat* below. `tradeUnitPrices` reads five things on the sell side — charisma above 1 (+1.5% each), district `influence` (+0.5% each, capped 2%), Curtis friendship while protection holds (+10%), Pherris recruited at tier 1+ in Downtown (+10%), and territory control (+4%) — and on the buy side district difficulty plus market awareness (4% a step), the plug's own modifier and standing discount, and plug suspicion (+10% at 3). The Goodie discount also reads Mina's band; Intelligence narrows the 907List sell swing, and since v1.19 an active Pherris is worth one effective level of it |
| Heat → the people around you | **Wired** | heat above 8 reaches the household, above 10 the neighborhood, above 12 the network (`propagateHeat`). There is still no job-*loss* mechanic; heat has social consequences instead of only police ones. The spec's ">60" remains unreachable: **heat is clamped 0–15** (`heatBand`: warm 4, high 8, critical 12, run ends at 15) |
| Heat → arrest → heat | **Wired** | every Stick tier and a blown Boost route through `arrestPlayer`, which *subtracts* heat and adds a permanent prior. The one path where heat comes back down through a criminal outcome rather than lying low |
| Criminal activity → Curtis's attention | **Wired** | `broadcastTracked` counts only observations that genuinely reach him on `network`; robberies add 2, heavy Spenard dealing 1/day. Quiet days bleed it back to the phase floor and no further |
| Crime → district difficulty | **Wired** | `recordCriminalActivity` raises per-district, per-track awareness; 3 points is one difficulty step, and it bleeds to adjacent districts at half strength the next day |
| Blocks → soldier income → heat | **Wired** | `resolveSoldierOperations` pays per assigned soldier nightly, and the raid roll that takes them away scales with player heat and the block's patrol frequency |
| Bank interest → daily tick | **Absent** | there is no bank. `base.storedCash` / `home.storedCash` are storage only — deposit and withdraw, no accrual. The only compounding interest is debt (`lender.interestMultiplier`) |

The heat-to-people connection was a design gap rather than broken wiring, and
closing it moved balance on purpose. **Bank interest is still absent**, and
building it is still new gameplay.

## Naming conventions

- **NPC ids** — lowercase first name: `mina`, `curtis`, `dre`, `goodie`, `pherris`
- **Event ids** — `snake_case`, arc-prefixed: `mina_intro`, `curtis_tax_demand`
- **Resolution flags** — derived, never hand-written: `resolvedFlagName("mina_intro")` ⇒ `minaIntroResolved`
- **State keys** `camelCase`; **CSS classes** `kebab-case`, flat, no nesting

**Canonical names, everywhere outside `migrateSave`:** Curtis (never Rook),
Goodie (never Kip Sallis), Mina (never Mara, Miri, or Samira), Pherris (never
Miri, she/her), Deshawn, Tone, Yalonda (never "wife"). **Heat is 0-15**, never
0-100 — any doc or comment quoting a heat threshold above 15 is describing a
scale this game does not have. The building is an **apartment**, and the tab is
**HUSTLE**, never Crime or Illegal.

**The player-facing word is "Rank", never "Identity" or "Street Identity"**
(v1.29). This is a display rule only: `streetIdentity`, `streetIdentityView`,
`describeStreetIdentity`, `historicalIdentity` and every internal key keep their
names, and so do the `.identity-pill` / `.identity-badge` CSS classes. Class
names and state keys are not player-facing; strings in `ui.jsx` are.

Some CSS classes are **built by interpolation** and a plain grep for the literal
name will not find them. Before deleting a rule, check for
`` `signal-${signal.id}` `` ⇒ `.signal-up` / `.signal-down` / `.signal-high` /
`.signal-low`, `` `${className}-backdrop` `` in `Modal` ⇒
`.encounter-modal-backdrop`, and `` `entity-${entityId}` ``,
`` `priority-row ${item.tone}` ``, `` `card ${entry.tone}` ``.

## The rail, and where income lives

Five tabs, fixed from the first morning: **Street · Hustle · Home · Phone ·
More**. None of them is conditional. Hustle used to appear only once
`hustle.visible` flipped on the first dirty income; v1.26 retired that gate when
Jobs moved onto the tab, because legal work exists on Day 1 and a hidden tab
would have made the player's own job unreachable. `hustle.visible` still gates
the illegal sections *inside* `HustleScreen` — it no longer gates the rail.

**Hustle is the one income surface**, legal work first: Jobs → 907List → Market
→ Boost → Stickup → Shark. Jobs is the row that renders before `hustle.visible`,
and the row itself carries the active employer, rank, and whether tonight's shift
is still open, so employment is readable without opening the list. Job discovery
is unchanged and still happens through `WANDER_SPENARD` out on the Street —
finding work is a thing you do in the neighborhood; managing it is a thing you do
here.

**907List followed Jobs onto the tab in v1.29**, for the same reason: it is an
income surface. It renders outside the `hustle.visible` gate, because resale is
not dirty work and `knowledge.knows907List` is already its own gate. Its old
rows under More and the Phone are gone. The **Home laptop row survives** and deep
links to `navigate("hustle", "root", "home", "907list")`, which is the one path
that sets `nav.sub` to `home` and therefore selects the laptop surface;
`setHustlePageSafe` clears `sub` on any in-screen navigation so the flag cannot
leak back onto the phone surface. `nineZeroSevenListAccess(state, surface)` is
untouched, so the move changed no pricing, access, or capacity rule.

**Bills are payable from the Phone.** The Bills accordion's rent and phone rows
dispatch the long-standing `PAY_RENT` / `PAY_PHONE_BILL` cases, which spend
through `spendCash` (dirty pool first), reset the obligation, write a feed line,
and cost no slot and no energy. The row's disabled state mirrors each reducer's
own guard rather than inventing a second rule, so a button is never offered for a
dispatch that would be dropped: rent cannot be pre-paid, and a dead phone must
still be settled in person. `PAY_PHONE_BILL` takes a `surface` — `store` answers
to the Spenard storefront's district gate, while `online` and `phone` do not,
because those two are surfaces the player carries with them.

## The feed, the phone, and what ends a run (v1.29)

**The feed shows three wrapped lines.** v1.26 cut it to one ellipsised line to
stop spending 88px of every screen on read history; the Aug 17 playtest measured
that trade and it came out the other way, because the one line it did show was
being cut off mid-sentence by `text-overflow: ellipsis`. Feed lines are narrative
content, so `Feed` renders `entries.slice(0, FEED_COLLAPSED_LINES)` (three) into
`.feed-lines`, which holds `min-height:74px` open so the panel does not resize
under the player's thumb as the day fills in. Nothing truncates at any width. The
expand control only renders once there is more history than the panel shows, and
is still a 44px target. The regression test is in `tests/ui-contract.test.js` and
it asserts the absence of the old `nowrap` + `ellipsis` pair by name.

**Phone texts can be dismissed and answered.** `state.phone.inbox` items grew an
optional `action` descriptor — `{ kind, jobId }` — set by `pushPhoneMessage`'s
fourth argument. `DISMISS_PHONE_MESSAGE` and `CLEAR_PHONE_INBOX` filter the list;
neither costs a slot, energy, or money, and neither answers to a district, for
the same reason paying a bill from your own phone does not. The only `kind` today
is `job_offer`, which renders Accept and Turn-it-down wired to the pre-existing
`ACCEPT_JOB` / `DECLINE_JOB` cases. Those buttons are gated on the offer still
being in `state.jobs.offers`, so a stale card degrades to dismiss-only instead of
dead-tapping, and `retireOfferMessages` takes the text down whenever the offer is
answered from anywhere. Messages saved before v1.29 carry no `action` and stay
informational, which is why none of this needed a migration.

**Attendance is the complement to `applyHeatEmployment`.** `applyAttendance`
runs inside `confirmDayEnd` and is shaped like the Heat ladder on purpose: the
employer says something before they do something, and the rung is legible.
`state.jobs.missedShifts[jobId]` counts **consecutive** days that ended without a
shift for the active employer, and any worked shift resets it to zero — so an
irregular schedule is never punished, only abandonment. Rung 1 is a feed line,
rung 2 is a text from the employer, rung 3 fires the player, resets the record
the way `ACCEPT_JOB` does, and broadcasts `job_lost` on `household` and
`neighborhood`. **Day labor is exempt at every rung**, the floor the run stands
on. **The Night Owl is de-scheduled rather than fired**, the same exemption the
Heat ladder already gives it. There is no RNG anywhere in the ladder. Grace
applies on `record.hiredDay`.

**As of v1.30 the ladder is finally visible to the simulator.** It shipped in
v1.29 verified only by unit tests: the fourteen strategies dispatched `WORK_JOB`
but never `APPLY_JOB` or `ACCEPT_JOB`, and `jobAvailability` requires
`activeJobId === jobId` for every employer that is not day labor — which the
ladder exempts at every rung. So `applyAttendance` had never once run inside a
simulated `CONFIRM_END_DAY`. The `worker` strategy holds a real employer across
the window, which means it runs every night, and `missedShiftRuns` /
`firedRuns` in the employment roll-up are the numbers a future change that
breaks it would move. **v1.31 stretched that window from ten days to forty**, so
the ladder now runs roughly four times as many nights per run and the same two
numbers cover far more ground.

There is deliberately **no employer roster in state**. `job.scheduled` is a
once-per-day flag and `lastScheduledShiftDay` records the day worked; neither is
a rota. "A day ended and you did not come in" is the honest reading of a missed
shift, and it is what the ladder counts.

**A lost run names the obligation that lost it.** `endRun(state, forced, cause)`
writes `run.endCause = { id, title, line }` and pushes it as a titled `bad`
consequence card. `householdWarning` passes the specific line it was already
writing for the feed, so an eviction says which obligation broke instead of the
generic `nowhere_to_go`; the other terminals derive theirs from `END_CAUSES`.
`selectRunSummary` exposes `endCause`, `daysSurvived`, `netGain` (derived from
the long-standing `stats.startingNetWorth`, not a new field) and
`reachedCheckpoint`, and `EndModal` leads with the cause, keeping the checkpoint
sentence only for runs that reached one. `ConsequencePopup` is now gated on a
live run so it cannot stack on top of the end screen it is repeating.

`run.endCause` is `run`-scoped and rebuilt by `NEW_RUN`; `missedShifts` and
`hiredDay` arrive through `mergeDefaults`. **Save schema stays v11.**

## Protected APIs

`tests/ui-contract.test.js` asserts against `ui.jsx` **as source text**, so
renaming a component or changing a className often breaks it. Treat these as
having a fixed public shape: `Modal`, `ExpandableMoreSection`, `EntityTooltip`,
`EntityText`, `EventModal`, `EncounterModal`, `TabUnlockedOverlay`,
`ConsequencePopup`, `AmbientTicker`, `Feed`, `ActionResultOverlay`, `GameShell`.

Two invariants worth naming: **no top-level `ui.jsx` function may delegate to a
`window` property of its own name** (the `playSound` recursion guard, which uses
`window.__907sfx`), and **tab changes go through the one `navigate()` funnel**
in `GameShell`, which wraps `document.startViewTransition` and degrades where it
is unsupported.

## Testing

```bash
npm test                              # 868 tests
node tests/simulate-runs.js --total 200
node tests/simulate-runs.js --total 2000   # slower, for balance work
```

**Seeds must be numeric, and a string seed fails silently.** `normalizeSeed`
(`src/events/random.js:10`) returns a single fallback constant whenever
`Number(seed)` is not finite, so `createRun({ seed: "alpha" })` and
`createRun({ seed: "beta" })` are **the same run**. Most of the suite passes
readable string labels, which is fine for a single-run fixture and actively
misleading in a loop: a test that iterates four string seeds to prove something
holds "across seeds" is running one seed four times. `tests/v1-24.test.js` shows
the fix — `seedFor(label)` hashes the label so the labels stay readable and the
seeds actually differ — and asserts the collapse directly so nobody
re-introduces it. `simulate-runs.js` was never affected: it seeds `1000 + i`.

**The simulator is the regression net for refactors.** Runs are seeded
(`1000 + i`) and fully deterministic, so identical output means identical
behavior. Hash it with `node tests/simulate-runs.js --total 200 | shasum -a 256`
before and after: a matching hash proves you changed nothing the player can see.
Nothing in the run path may use `Math.random()` — only `makeRandom(seed)`, and
not even that where a `stringHash` off the seed will do.

**Current baselines, set at v1.33** — `--total 200`
`1f1e32b63829681efd120cbc108212b53fb9cfad781cb392a71c111334dfa27d`, `--total 2000`
`d617a1b371f4ee76ec776825cfd5ad53c15621046ce7e35972d3e50ea2814d5d`. They moved because
v1.33 added a sixteenth strategy (`debtor`), taught every profile to rest, and
made the harness horizon binding; the v1.32 pair was `dc1b7bd2…` / `a56bc1f9…`. **Everything moved, and no
per-strategy equivalence is claimed this time** — deliberately. v1.31 removed the
day-count terminator, so all fifteen strategies now run to the harness's 40-day
`maxDays` instead of stopping around day 10. There is no unchanged subset to
compare against; the previous pair was v1.30's `fb6725fc…` / `8a708445…`.

**`maxDays` is where the boundary lives now.** Per-strategy, default 40, and the
harness exits through the same voluntary `EXECUTE_FINAL_PLAN` a player uses
rather than through a mechanic the game imposes. Raising or lowering it moves
both hashes by design. A 200-run pass takes about 55 seconds at 40 days.

**When a build does leave a subset of strategies untouched**, prove it the v1.25
way rather than diffing raw output: `--total N` re-partitions a fixed budget, so
adding or removing a strategy changes every block's `runs` count even where
behavior did not. Call `summarize(name, 15)` per strategy at a fixed count on
both sides and compare with new keys stripped. v1.30 did this for its fourteen
originals; strategy-specific telemetry is gated on a profile flag precisely so
that comparison stays an equality rather than a diff with exceptions.

**v1.28 rewrote the nightly Curtis resolution and both hashes came back
byte-identical — which is a finding about the simulator, not a lucky escape.**
The build was expected to move them. It did not, because the `territory` strategy
claims **zero blocks in 200 runs** (`territoryAttempts: 0`), so no strategy ever
owns a corner, `curtisMoveChance` is never called on a player-owned block, and
every constant this build tuned is unreachable from the harness. The fourteen
strategies are therefore provably behavior-identical by the hash itself, and the
block layer's only real instrument remains
`tests/measure-lieutenant-modifiers.js`. **Do not read an unchanged hash as
coverage of the territory layer.**

**A UI-only build cannot move these hashes.** The simulator `require`s
`game-core.js` and nothing else — it never reads `ui.jsx`, `v05.css`, or
`index.html` — so a screen can be rebuilt from scratch without the harness
noticing. v1.26 moved Jobs to another tab, deleted two pages, and added bill
payment buttons, and both hashes came back byte-identical. That is the expected
result for a build of that shape, not a lucky one: if a UI move *does* move a
hash, the diff touched `game-core.js` in a way you did not intend.

**Adding or removing a strategy invalidates a raw before/after diff.** `--total N`
splits a fixed run budget across the strategy table, so a fourteenth entry
re-partitions it (16/15 runs each becomes 15/14) and *every* existing block
changes. To prove behavior invariance, call `summarize(name, count)` per strategy
at a **fixed** count on both sides and compare with new keys stripped — the
technique v1.20 used for telemetry-only keys. It is worth the trouble: it caught
v1.25 computing the trade buy budget before the SELL loop instead of after, which
had silently changed all seven product-carrying strategies.

**The old baselines, and why they held so long.** v1.21 through v1.24 were all
byte-identical to v1.20, and that was a real check rather than a coincidence: no
sim strategy ever reached the block layer, so the nightly territory pass drew
nothing from the tick's RNG either before or after the raid split. Moving the two gates onto `stringHash` was chosen partly for
that — a change this deep in the nightly resolution that leaves both hashes
untouched has proven it changed nothing outside the corners. If either hash moves
on a territory build, something else in the diff touched the stream. The v1.19
baselines were `114d08f7…` / `1bd2c299…`; the v1.18 ones `9ae8cd3c…` / `b233d725…`.

**The de-escalation refactor in the same build is hash-neutral**, and was
measured that way deliberately: it shipped as its own commit and both hashes came
back byte-identical to v1.18 before anything else landed. That is the check that
matters for a refactor. It is *not* behavior-identical in principle — the three
inline sites tested `status !== "departed"` and `getActiveCrew` tests
`status === "active"`, so an arrested Deshawn no longer de-escalates — but the
simulation never lands an arrest on him and a de-escalatable encounter in the
same run. A hash cannot prove a case it never reaches, so that one is pinned by a
unit test in `tests/v1-15.test.js`.

The v1.20-through-v1.24 baselines, superseded by the v1.25 pair above:

| Run | SHA-256 |
|---|---|
| `--total 200` | `c8b3bf0745871555c326f4861b0a8d576ce149c9fa7bd871e9215b51236092d8` |
| `--total 2000` | `d9d0fbf1d24c1c7cca8db9db7897f044811a46c4d41ff6a23ca678a0dc3dfb39` |

When a hash moves, read the per-strategy metric blocks — the simulator reports
`arrests` and `crewJailedAtEnd` for exactly that. The two argument forms differ:
`--total 200` splits 200 runs across the fourteen strategies, a bare `200` runs
200 *per strategy*.

The fourteen are cautious, balanced, aggressive, stickup, legal_worker, trader,
thief, gambler, trainer, mixed_freedom, operator, flipper, broker, and
territory; the report
covers endings, economy, story beat counts, identity assignment, and dead ends.
The two 907List strategies also report a `market` block with per-tier daily income
against the design targets — the only way to tell a tuned tier ladder from
unreachable content, so a change to `src/data/market.js` is checked against that
rather than the hash alone.

## Voice and writing rules

Enforced by `tests/ui-contract.test.js` and `tests/v1-8.test.js`, on player copy
and ambient lines alike:

- **No em dashes or en dashes** in player-facing copy
- **No vague intensifiers**: real, really, very, truly, actually, basically, literally
- **No "not X but Y"** negation pivots; no "pace" or "progress bar" framing
- Ambient lines stay under 40 words
- No retired identity strings (`Mara Velez`, `Rook Mercer`, `Kip Sallis`, `Dre Holloway`)
- Time is named by part of day (Morning/Afternoon/Evening/Night), never "slot"

## Constraints

- **esbuild is the only dependency.** No runtime dependencies at all.
- 44px minimum tap targets; no horizontal overflow at any viewport
- `prefers-reduced-motion` fallbacks required for animation
- Saves at v3, v4, and v5 must keep loading
- Mobile-first: the 320px shell is the design floor
- Heat stays clamped 0-15; attributes stay unseen behind their labels

## Reference docs (ClickUp)

- [Expanded Vision — Classless Growth, Access, and Obligations](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-14414)
- [Build Changelog](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-14874)
- [Systems & Design Decisions](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-7334)
- [v1.7 Playtest & v1.8 Future Build Ideas](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-15114)
- [Bug Tracker / Known Issues](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-7374)
- [Anton "Tone" Bell (Enforcer / Crew)](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-15174) — the voice and tier intent behind `RECRUITMENT_PROOF.tone`
