# ARCHITECTURE

How 907Hustle: One Good Run is put together, current as of **v1.17**. This file
is meant to be the only thing you need to read before changing code; for *why*
the game is designed the way it is, see the ClickUp docs at the bottom.

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
                        presence-effect framework, Made Men / Guards note
  curtis-awareness.js   Phases and floors, watcher pools, phase texts, chance formula
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
src/selectors.js        Tiny pure reads shared by game-core and src/events

tests/                  node --test, no runner config
  simulate-runs.js      Seeded whole-run simulator (not a test; a harness)
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
| A new NPC | `src/data/npcs.js`, state in `createNpcState()`, a lens in `NPC_LENSES`, channels in `NPC_CHANNELS` |
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

`{ type, event, location, value, day, count, source }`. `type` is one of eleven
categories: `presence`, `honesty`, `violence`, `financial`, `heat_exposure`,
`loyalty`, `betrayal`, `discretion`, `growth`, `submission`, `defiance`. Rows
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
Spenard market transactions in a day, once per day; **+2** per successful robbery.
**Nothing** from The Nile or the gym. **What lowers it:** the day-end block
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
NPC-specific conditions on top in `crewTierAvailability` (Deshawn: two truces and
two blocks; Tone and Pherris: controlled blocks; Pherris: cash). Tier 3's
twelve-day gate is near-unreachable inside a 7-day pressure window; it ships as
written, centralized so it can be tuned in one place. Wages come off a per-tier
curve in `TIER_WAGES` — only Deshawn's is authored ($50 / $100 / $200), and
anyone without an entry keeps their flat roster wage at every tier.

### Wage settlement

`settleCrewWages` runs at day end, dirty cash first, **highest loyalty first** —
so when the roll comes up short the arrears land on whoever trusts the player
least. A missed night accrues to `wageDue`; the first two are grace
(`CREW_WAGE_GRACE_DAYS`), every night after costs a loyalty point. At 0 the
member departs: assignments and block manager slots clear, and the record stays
(history matters) but stops counting toward capacity, power, wages, or presence
effects. `PAY_CREW` clears arrears mid-run.

### Presence effects

`PRESENCE_EFFECTS` is what an active member changes about event resolution just
by being on the payroll. Checked at **choice-build time** (the encounter
selectors and card builders), not at render time, so the reducer and the UI
agree about which choices exist. Deshawn is the only one authored: he
de-escalates encounters and the stick retaliation card, but deliberately **not**
`CURTIS_CREW_ENCOUNTER_IDS` — Curtis's own people pay him no respect at tier 1.

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
3. **Raids.** `0.10 + heat * 0.02 + patrol * 0.15 - eliEffectiveness * 0.05`,
   capped at 0.9. A raid loses one soldier, adds a heat point, and writes a
   `growth / visible_business` row to Curtis; a further 35% flips the block back
   to him.
4. **Attrition.** An idle-loss roll per soldier, `0.05 - eliEffectiveness * 0.01`.

The pass reports as one "Eli's report" feed line per crossed day.

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
| Consequence cards → phone / day log | **Wired** | `logEntry` (:452), `pushConsequence` (:456), `pushPhoneMessage` (:461) |
| Heat → encounter frequency | **Wired, not via weightedPick** | ambient chance carries `+ heat * 0.01` (:3156); police/rival cards gate on heat (:3033 `heat >= 5`, :2933 `heat >= 10`); block raids scale with `RAID_HEAT_WEIGHT` (:2607). Heat is **not** a term in `getWeight` |
| Reputation → vendor pricing | **Closed as a design decision** | see *Reputation is not a stat* below. `tradeUnitPrices` reads five things on the sell side — charisma above 1 (+1.5% each), district `influence` (+0.5% each, capped 2%), Curtis friendship while protection holds (+10%), Pherris recruited at tier 1+ in Downtown (+10%), and territory control (+4%) — and on the buy side district difficulty plus market awareness (4% a step), the plug's own modifier and standing discount, and plug suspicion (+10% at 3). The Goodie discount also reads Mina's band; Intelligence narrows the 907List sell swing |
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
Miri), Deshawn, Tone. **Heat is 0-15**, never 0-100 — any doc or comment quoting
a heat threshold above 15 is describing a scale this game does not have.

Some CSS classes are **built by interpolation** and a plain grep for the literal
name will not find them. Before deleting a rule, check for
`` `signal-${signal.id}` `` ⇒ `.signal-up` / `.signal-down` / `.signal-high` /
`.signal-low`, `` `${className}-backdrop` `` in `Modal` ⇒
`.encounter-modal-backdrop`, and `` `entity-${entityId}` ``,
`` `priority-row ${item.tone}` ``, `` `card ${entry.tone}` ``.

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
npm test                              # 601 tests
node tests/simulate-runs.js --total 200
node tests/simulate-runs.js --total 2000   # slower, for balance work
```

**The simulator is the regression net for refactors.** Runs are seeded
(`1000 + i`) and fully deterministic, so identical output means identical
behavior. Hash it with `node tests/simulate-runs.js --total 200 | shasum -a 256`
before and after: a matching hash proves you changed nothing the player can see.
Nothing in the run path may use `Math.random()` — only `makeRandom(seed)`, and
not even that where a `stringHash` off the seed will do.

**Current baselines, verified at v1.17.** Both moved on purpose at v1.16 (the
arrest build rewrote two failure paths) and v1.17's copy pass and Market button
removal left both **byte-identical**, because the reducer's `END_MARKET`
behavior did not change and the simulator dispatches actions directly.

| Run | SHA-256 |
|---|---|
| `--total 200` | `c828c00e7a5b6e0e0af740ca4f4f91a17fd16dcf8cc180265a629d1f07e07d08` |
| `--total 2000` | `5fefb813fc0a73e5d83271fbf0c1a50636b7a2842153728f9eb8b4ee36455e6f` |

When a hash moves, read the per-strategy metric blocks — the simulator reports
`arrests` and `crewJailedAtEnd` for exactly that. The two argument forms differ:
`--total 200` splits 200 runs across the thirteen strategies, a bare `200` runs
200 *per strategy*.

The thirteen are cautious, balanced, aggressive, stickup, legal_worker, trader,
thief, gambler, trainer, mixed_freedom, operator, flipper, and broker; the report
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
