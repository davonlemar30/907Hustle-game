# ARCHITECTURE

How 907Hustle: One Good Run is put together, current as of **v1.10**.

This file is meant to be the only thing you need to read before changing code.
For *why* the game is designed the way it is, see the ClickUp docs at the bottom.

---

## The shape of it

A single-player, mobile-first web game. No backend, no framework beyond React,
no runtime dependencies. State lives in one reducer; the save is one JSON blob
in `localStorage`.

A run is **7 days x 4 parts** (Morning, Afternoon, Evening, Night). Week Zero is
the opening stretch that establishes the player's life in Spenard; the pressure
phase follows and runs to a checkpoint day.

---

## File map

```
index.html            Loads React UMD (production) + ui.built.js. Nothing else.
ui.built.js           BUILD OUTPUT, committed. Never edit; run `npm run build`.

src/index.jsx         Bundle entry. Import order matters (see Build).
game-core.js          The barrel: all game logic, state, and the reducer.
ui.jsx                The entire React UI, one file.
encounters.js         Authored encounter construction.
v05.css               The entire stylesheet.

src/data/             Static definitions. No logic, no state.
  products.js         PRODUCTS, PRODUCT_BY_ID
  locations.js        HOME_DISTRICT_ID, NEIGHBORHOODS, TERRITORIES, SPENARD_BLOCKS, AREA_BY_ID
  items.js            GEAR, BASE_UPGRADES (re-exports the 907List catalogue)
  market.js           907List: LISTING_ITEMS, MARKET_TIERS, ROBBERY, buyer requests
  jobs.js             SPENARD_JOBS, JOB_APPROACHES, JOB_RANK_THRESHOLDS, STARTER_JOB_IDS
  npcs.js             CREW, DEALERS, PLUGS, HOUSEHOLD_NPCS, NIGHT_OWL_REGULARS + lookups
  observations.js     OBSERVATION_CATEGORIES, createObservation(), addObservation(), effectiveCount()
  npc-lenses.js       ARCHETYPES, SHARED_EVENT_WEIGHTS, NPC_LENSES, resolveLens()
  propagation.js      CHANNELS, NPC_CHANNELS, Curtis's filter, heat thresholds, presence tables
  disposition-bands.js  BANDS, bandFor()

src/events/
  registry.js         ENTITY_REGISTRY, ENTITY_MATCH_ORDER, EVENT_FLAVOR, EVENT_CONTEXT, AMBIENT_FLAVOR
  cards.js            event(), effectPreview(), activeEvent() — every event card
  random.js           Seeded RNG + isEligible() / getWeight()
  market-events.js    907List rolls: robbery risk, snipes, flakes, sale price,
                      buyer requests, bulk deals. stringHash only, never
                      run.rngState, and never game-core.

src/exposure/
  engine.js           The Exposure System: ledgers in, dispositions out, gossip
                      in between. May require src/data and src/selectors and
                      NOTHING else — never game-core.

src/selectors.js      Tiny pure reads shared by game-core and src/events

tests/                node --test, no runner config
  simulate-runs.js    Seeded whole-run simulator (not a test; a harness)
  exposure-helpers.js putInBand() for tests that used to assign a trust integer
```

**`game-core.js` is a barrel.** It requires from `src/` and re-exports through one
`api` object. Its export shape is a contract: `ui.jsx` and every test read it.

### Where do I put a new thing?

| Adding | Goes in |
|---|---|
| A story beat / character arc card | `src/events/cards.js` + a descriptor in `STORY_REGISTRY` |
| A new NPC | `src/data/npcs.js`, state in `createNpcState()`, a lens in `NPC_LENSES`, channels in `NPC_CHANNELS` |
| A new observation category | `OBSERVATION_CATEGORIES` in `src/data/observations.js` + a weight in all four archetypes |
| A named letdown (something that costs standing) | `SHARED_EVENT_WEIGHTS` in `src/data/npc-lenses.js` |
| A thing an action makes visible | `OBSERVED_ACTIONS` in `game-core.js` |
| A new job | `src/data/jobs.js` |
| A product, district, or gear item | the matching `src/data/` file |
| A 907List listing, tier, or risk constant | `src/data/market.js` |
| A 907List probability roll | `src/events/market-events.js`, hashed off the seed |
| Tooltip copy for a name | `ENTITY_REGISTRY` in `src/events/registry.js` |
| Ambient street lines | `AMBIENT_FLAVOR` in `src/events/registry.js` |
| A new action the player can take | a case in `reduceGame` (`game-core.js`) |
| A new screen | `ui.jsx` |

---

## Build and deployment

```bash
npm install
npm run build     # esbuild, ~20ms
npm test          # node --test tests/*.test.js
npm run sim       # 200 seeded runs
```

GitHub Pages serves this repo **directly, with no CI**. That means:

> **`ui.built.js` must be rebuilt and committed with any change to `ui.jsx`,
> `game-core.js`, `encounters.js`, or anything in `src/`.**
> A test enforces that the bundle exists and that Babel is gone, but it cannot
> tell you the bundle is stale. Run `npm run build` before you commit.

React and ReactDOM stay UMD globals from `index.html`. esbuild's default JSX
factory emits `React.createElement`, which resolves to the global, so React is
never bundled. `v05.css` is linked, not bundled.

`src/index.jsx` imports `game-core.js` **before** `ui.jsx`. `ui.jsx` reads
`window.GameCore` on its first line, so reversing the two breaks the app.

Until v1.8.1 the JSX was compiled in-browser by `@babel/standalone`. Do not
reintroduce it. Beyond the load cost, Babel's classic-script compilation made
every top-level declaration a `window` property, which is what caused the v1.6
`playSound` infinite recursion. Inside the bundle, top-level declarations are
module-scoped and `window.playSound` is `undefined`.

---

## State and saves

`SAVE_KEY = "907ogr_v8"`, `VERSION = 8`, `LEGACY_SAVE_KEYS = ["907ogr_v7", "907ogr_v6", "907ogr_v5", "907ogr_v4", "907ogr_v3"]`.

Top-level state sections:

```
version   run        player     inventory  phone      knowledge  discovered
memberships          world      base       lender     people     npc
obligations          plugs      market     hustle     jobs       contacts
onboarding           nightOwl   nineZeroSevenList     rob        boost
home      flags      encounterLog          effects    stats      streetRead   log
```

Notable ones:

- `run` — day, slot, seed, `rngState`, `phase` (`week_zero` | `pressure`),
  `checkpointDay`, `pendingEvent`, `eventHistory`, `recentEvents`,
  `pendingObservations` (gossip in transit)
- `player` — `cash` / `dirtyCash` / `cleanCash` (money is split by provenance),
  `heat`, `health`, `energy`, `attributes`, `streetIdentity`
- `npc` — `yalonda`, `juan`, `mina`, `curtis`, `dre`, `simone`. Each carries a
  `ledger` (array of observations) and `channels` (what they hear on). The
  surviving `trust` / `attention` / `respect` integers are **inert**: they exist
  so a v5 save has somewhere to land during migration, and nothing gates on them
- `people` — `household`, `crew`, `dealers`
- `nineZeroSevenList` — the 907List broker track. `tier`, `flipCount`,
  `disputes`, `categoryFlips`, `specialist`, `inventory[]`, `pendingSells[]`,
  `buyerRequests[]`, `bulkDeal`, `taken`. **`tier` and `specialist` are mirrors,
  not sources**: both are recomputed by `marketTier()` / `specialistCategory()`
  on every hydrate and after every flip, so a hand-edited or stale save cannot
  grant a tier. Note this is *not* `state.market`, which is the plug/drug market
  visibility flag and unrelated

### Migration rules

- **Additive only.** Never remove or repurpose a field; add a new one.
- `migrateSave(value)` accepts versions **3 through 7** and returns `null` for
  anything older or malformed. It is one flat pass, not a v3→v4→v5→v6 chain: every
  accepted version takes the same code path. `hydrateRun` fills defaults via
  `mergeDefaults`.
- `hydrateRun` captures the version **before** calling `migrateSave`, because
  `migrateSave` stamps the version to current and merges in default state. That
  captured value is the only way to tell a pre-Exposure save from a converted
  one, and it is what decides whether `seedExposureLedgers` runs.
- `seedExposureLedgers` sits **after** `hydrateRun` on purpose:
  `tests/v1-8-1.test.js` treats everything between `migrateSave` and
  `hydrateRun` as the amnesty window where legacy character ids are allowed, and
  nothing else belongs in it.
- To bump the version: raise `VERSION`, push the old key onto
  `LEGACY_SAVE_KEYS`, and extend `migrateSave`.

**`migrateSave` is the one place legacy character ids may appear.** The v1.7/v1.8
renames (`rook`→`curtis`, `mara`→`mina`, `kip`→`goodie`, `miri`→`pherris`) are
complete everywhere else, and old saves still carry the old keys.
`tests/v1-8-1.test.js` walks every runtime source file and fails on a legacy id
found outside `migrateSave`.

---

## Event cards

Two halves. A **descriptor** in `STORY_REGISTRY` decides *whether and when* a card
fires; a **builder** in `src/events/cards.js` decides *what it says*.

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

`tests/v1-8-1.test.js` validates every descriptor against this shape. A
`weight` of 0 fails, because a zero-weight card can never be drawn.

### How a card gets picked

1. `storyCandidates(state)` filters `STORY_REGISTRY` through
   **`isEligible(card, state, { absolute, resolved })`** (`src/events/random.js`).
2. `weightedPick` scores survivors with **`getWeight(card, state, multiplier)`**.
3. `fireStory` records it in `eventHistory` and sets `run.pendingEvent`.

`isEligible` is the single gate: Week Zero hold-back, `once`, district,
`earliest`, `latest`, `recentEvents`, `cooldown`, `exit`, then `requires`. Put
new gating there, not inline in a caller.

Week Zero suppresses the `dre_note` and `curtis_pressure` chains and the
`threat` / `ending_setup` classifications. Both lists are named constants at the
top of `random.js`.

---

## The Exposure System

Added in v1.9a. It replaced every per-character relationship integer, so it is
the thing to understand before touching any NPC.

An NPC knows three things:

1. a **ledger** of typed observations — concrete facts about what you did
2. a **lens** — a personality weight table that decides what those facts mean
3. a **disposition** — the sum, recomputed on every read and never stored

Because the score is derived, *how* you earned it survives. Two players at the
same number got there through different rows, and the rows are what later
content and later gossip actually see.

### Observations

`{ type, event, location, value, day, count, source }`. `type` is one of eleven
categories: `presence`, `honesty`, `violence`, `financial`, `heat_exposure`,
`loyalty`, `betrayal`, `discretion`, `growth`, `submission`, `defiance`.

Rows merge on category + event + location + source, incrementing `count`. Source
is part of the key on purpose: watching a robbery and hearing about one are
different facts.

**Diminishing returns.** `min(4, log2(count + 1))`. The clamp matters as much as
the curve: `log2` has no upper bound, so without it a patient player reaches the
top band by doing one thing four hundred times. Two rules opt out —
`betrayal` never fades, and `missed_obligation` escalates linearly because its
weight is negative.

### Lenses

Four archetypes (CIVILIAN, STREET, ROMANTIC, THREAT) carry a full weight table;
an NPC picks one and overrides three to five entries. Adding a character is a
base plus a handful of numbers.

**THREAT is inverted.** For a rival, a high score is not affection, it is being
no problem to them. Everything that makes you worth noticing drives Curtis's
number *down*, which is why he reads Neutral as invisible, Cold as watched, and
Hostile as the tax and the confrontation. Use `curtisNoticed()` /
`curtisHostile()`, never a bare `>=` against him.

**Category sign is not reliable downward.** STREET scores `defiance` positively
on purpose — Dre respects nerve. Anything meaning "you cost me something" is
priced explicitly in `SHARED_EVENT_WEIGHTS` instead of inheriting its category.

### Bands

Hostile `< -5` · Cold `-5..-1` · Neutral `0..2` · Warm `3..5` · Trusted `6..8` ·
Bonded `9+`. Ordered integers, so a gate is one comparison. Content asks
`atLeastBand(state, "mina", BANDS.TRUSTED)`; the old per-character thresholds are
gone.

Mapping from the retired integers: trust 1 is Warm, trust 2 is Trusted, trust 3
is Bonded. `knowsYou()` covers the checks that meant "any relationship at all".

### Propagation

Five channels decide who hears what and when: `direct` (now), `household` (that
night), `neighborhood` (1-2 days, presence-checked), `network` (next day),
`reputation` (weekly). An event card tags an observation with a channel; the
engine routes it. Curtis's network runs through a sensitivity filter — only
violence, territory claims, and high-volume days clear it. Heat above 8/10/12
spreads on its own with no card involved.

Delayed items queue in `run.pendingObservations` and drain in `advanceRun` and
twice in `confirmDayEnd` (once before the day rolls, once after), following the
`resolveJobApplications` pattern.

**Determinism.** The 1-2 day neighborhood spread is resolved by
`stringHash(seed:gossip:...)`, not the RNG stream. Drawing from `run.rngState`
would make an observation's fate depend on whether an unrelated encounter
consumed a draw earlier that day.

### Where the writes happen

`applyEventEffect` is the one seam. Sixty relationship effects are declared
across the event cards (`minaTrust`, `lenderTrust`, `rivalRespect`,
`rivalPressure`, `npcTrust`); they stay declared as they are and are translated
into observations in `applyRelationshipEffects`. Do not rewrite the cards.

`OBSERVED_ACTIONS`, keyed on the same `context.reason` as `STREET_READ_ACTIVITY`,
covers everything that funnels through `advanceRun`.

### Debugging

`localStorage.setItem("907_exposure_debug", "1")` renders a dev-only inspector
showing each NPC's rows, the weight applied, the effective count after
diminishing returns, and the running total. It never appears for a player.

---

## Attributes

Added in v1.10. Three numbers - **Combat**, **Charisma**, **Intelligence** - and
they are the invisible engine behind every outcome the player sees.

Before v1.10 the player carried six attributes and three *derived* ratings
computed from them. The six were half-dead (only the physical three could grow)
and the ratings were the only thing anything read, so the middle layer was
deleted: the ratings became the stored attributes. A v7 save folds the six into
three by taking the highest of each merged group, documented in
`src/data/attributes.js`.

`combatRating()` / `charismaRating()` / `intelligenceRating()` survive as the
**compatibility scale**. They clamp to 1-5, which is the range every formula
written before v1.10 was tuned against, so crew power, takeover odds, and trade
pricing did not silently move when an attribute became able to reach 8. Anything
routed through `resolveWithAttribute` reads the raw value instead and carries no
inline term.

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
the ratios in `OUTCOME_SHAPES`, so all of that context survives and quality is
added on top. A flat weighted table would have thrown it away.

Where an attribute term used to sit inside a chance formula it has been removed
and the constant re-anchored to that formula's value at **attribute 1** — an
untrained player faces exactly the odds they always did, and everything above
that comes from advantage. Carrying both would pay the player twice.

`stringHash`, never `run.rngState`. Same reason as the market and the gossip
delay: a replay of the same day must resolve the same way regardless of what
else happened first.

### Quality decides the footprint

This is the keystone. When an outcome resolves, its **tier** selects an entry in
`OUTCOME_OBSERVATIONS`, and `broadcastOutcome` in `game-core.js` fans those
observations out. A clean job still writes its row — being good at crime makes
you quieter, not invisible — but it travels on `direct` instead of reaching the
neighborhood and the network.

Adding a new action is two data entries and no new code: a shape in
`OUTCOME_SHAPES` and a map in `OUTCOME_OBSERVATIONS`.

### Street Identity is derived

`getStreetIdentity(state)` is pure: dominant attribute × dominant recent
observation category, read off `IDENTITY_MATRIX`. The nightly assignment loop,
its two-night hysteresis, and the stored `player.streetIdentity` are gone. An old
save keeps its label as `player.historicalIdentity`, display-only.

Identity is **cosmetic**. It never gates content, modifies a roll, or touches
disposition. Balanced means no attribute leads by more than two.

The `behavior` ledger survived the change: it no longer drives identity, but it
still feeds the Character screen's recent-reputation list.

### Growth

The gym is the only growth source that ships in v1.10 (Charisma and Intelligence
sources are a later build). `attributeGrowth` uses the same `log2` shape as the
Exposure System's observation capping, for the same reason: sessions one through
three move the needle, four through seven taper, and past that the gym alone
cannot carry you. Getting past Solid takes confrontations, not another hour on
the bag. Three consecutive gym **days** bank `player.gymStreak`, worth +1
effective Combat on the next check that reads it, spent on use.

---

## Reputation is not a stat

There is no global reputation stat and there will not be one. It was an open
ticket from v1.8's system audit; v1.10 closes it as a design decision rather than
a feature.

What people mean by "reputation" is already three things the game models better
separately:

- **NPC dispositions** — what specific people think, derived from what they
  actually saw. A single number would flatten Curtis reading you as no problem
  and Mina reading you as safe into the same value, when they are opposite facts.
- **Intelligence** — what you can read and price, which is a capability rather
  than an opinion anyone holds about you.
- **The existing pricing signals** — district influence, territory control, plug
  standing, Broker verification.

A global scalar on top of those would either duplicate them or contradict them.
Do not add a `reputation` field to `state.player`, and do not write code comments
that promise one.

## System connections

Audited in v1.8.1. Line numbers are `game-core.js` unless noted, and drift.

| Connection | State | Evidence |
|---|---|---|
| Phone off → missed events | **Wired** | `pushPhoneMessage` only delivers when `phone.active` (:463); job callbacks stall (:472); story cards gate on it (:3003, :3011, :3013); unpaid bill cuts service (:2706) |
| Yalonda trust → housing | **Wired** | rent due (:4463); `householdWarning` accumulates (:3333); 3 warnings ⇒ `evicted` + `endRun` (:3336) ⇒ `nowhere_to_go` ending (:3303) |
| Juan trust → lead quality | **Wired** | `juanWorkIntelKnown` (:1752) unlocks the `ship_creek` job (:1913); trust gates the Dre route (:2418) and two story cards (:3003, :3011) |
| Consequence cards → phone / day log | **Wired** | `logEntry` (:452), `pushConsequence` (:456), `pushPhoneMessage` (:461) |
| Heat → encounter frequency | **Wired, not via weightedPick** | ambient chance carries `+ heat * 0.01` (:3156); police/rival cards gate on heat (:3033 `heat >= 5`, :2933 `heat >= 10`); block raids scale with `RAID_HEAT_WEIGHT` (:2607). Heat is **not** a term in `getWeight` |
| Reputation → vendor pricing | **Closed in v1.10** | settled as a design decision rather than a feature: see *Reputation is not a stat* below. `tradeUnitPrices` moves the sell price by charisma, district `influence`, Curtis friendship, Pherris tier, and territory control; the Goodie discount reads Mina's band; and Intelligence now narrows the 907List sell swing |
| Heat → the people around you | **Wired in v1.9a** | heat above 8 reaches the household, above 10 the neighborhood, above 12 the network (`propagateHeat`). There is still no job-*loss* mechanic; heat now has social consequences instead of only police ones. The spec's ">60" remains unreachable: **heat is clamped 0–15** (`heatBand`: warm 4, high 8, critical 12, run ends at 15) |
| Bank interest → daily tick | **Absent** | there is no bank. `base.storedCash` / `home.storedCash` are storage only — deposit and withdraw, no accrual. The only compounding interest is debt (`lender.interestMultiplier`) |

v1.9a was that build for the heat connection: it was a design gap rather than
broken wiring, and closing it moved balance on purpose. **Bank interest is still
absent**, and building it is still new gameplay.

---

## Naming conventions

- **NPC ids** — lowercase first name: `mina`, `curtis`, `dre`, `goodie`, `pherris`
- **Event ids** — `snake_case`, arc-prefixed: `mina_intro`, `curtis_tax_demand`
- **Resolution flags** — derived, not written by hand: `resolvedFlagName("mina_intro")` ⇒ `minaIntroResolved`
- **State keys** — `camelCase`
- **CSS classes** — `kebab-case`, flat, no nesting

Some classes are **built by interpolation** and a plain grep for the literal name
will not find them. Before deleting a rule, check for:

- `` `signal-${signal.id}` `` ⇒ `.signal-up`, `.signal-down`, `.signal-high`, `.signal-low`
- `` `${className}-backdrop` `` in `Modal` ⇒ `.encounter-modal-backdrop`
- `` `entity-${entityId}` ``, `` `priority-row ${item.tone}` ``, `` `card ${entry.tone}` ``

---

## Protected APIs

`tests/ui-contract.test.js` (48 tests) asserts against `ui.jsx` **as source text**.
Renaming a component or changing a className often breaks it. Treat these as
having a fixed public shape:

`Modal`, `ExpandableMoreSection`, `EntityTooltip`, `EntityText`, `EventModal`,
`EncounterModal`, `TabUnlockedOverlay`, `ConsequencePopup`, `AmbientTicker`,
`Feed`, `ActionResultOverlay`, `GameShell`.

Two invariants worth naming:

- **No top-level `ui.jsx` function may delegate to a `window` property of its own
  name.** That is the `playSound` recursion guard; it uses `window.__907sfx`.
- **Tab changes go through the one `navigate()` funnel** in `GameShell`, which
  wraps `document.startViewTransition` and degrades where it is unsupported.

---

## Testing

```bash
npm test                              # 437 tests
node tests/simulate-runs.js --total 200
node tests/simulate-runs.js --total 2000   # slower, for balance work
```

**The simulator is the regression net for refactors.** Runs are seeded
(`1000 + i`) and fully deterministic, so identical output means identical
behavior. Before a refactor:

```bash
node tests/simulate-runs.js --total 200 | shasum -a 256
```

Compare after. A matching hash proves you changed nothing the player can see.

**v1.10 baselines.** Attribute checks moved every wired roll off `run.rngState`
and onto seed hashes, which reorders the shared stream for every strategy, so the
hash necessarily changed and proves nothing on its own. Check the per-strategy
metric blocks instead. These replace the v1.9b hashes of `d4474787…` /
`ddd76695…`:

| Run | SHA-256 |
|---|---|
| `--total 200` | `77b09d7bb1ea9be7440bccac517175679fce3008e83f02923e3cb0a3f4c573ac` |
| `--total 2000` | `8f68db014f0fe466f38edad05454f632fb90ca2eef0c9c8af4707bb30714990b` |

Note the two forms differ: `--total 200` splits 200 runs across the thirteen
strategies, while a bare `200` runs 200 *per strategy*.
Nothing in the run path may use `Math.random()` — only `makeRandom(seed)`.

The simulator plays thirteen strategies (cautious, balanced, aggressive, stickup,
legal_worker, trader, thief, gambler, trainer, mixed_freedom, operator, and the
v1.9b pair flipper and broker) and reports endings, economy, story beat counts,
identity assignment, and dead ends.

The two 907List strategies also report a `market` block with per-tier daily
income against the design targets. That is the only way to tell a tuned tier
ladder from unreachable content, so a change to `src/data/market.js` should be
checked against it rather than against the hash alone.

---

## Voice and writing rules

Enforced by `tests/ui-contract.test.js` and `tests/v1-8.test.js`, on both player
copy and ambient lines:

- **No em dashes or en dashes** in player-facing copy
- **No vague intensifiers**: real, really, very, truly, actually, basically, literally
- **No "not X but Y"** negation pivots
- Ambient lines stay under 40 words
- No retired identity strings (`Mara Velez`, `Rook Mercer`, `Kip Sallis`, `Dre Holloway`)
- No "pace" or "progress bar" framing
- Time is named by part of day (Morning/Afternoon/Evening/Night), never "slot"

---

## Constraints

- **esbuild is the only dependency.** No runtime dependencies at all.
- 44px minimum tap targets; no horizontal overflow at any viewport
- `prefers-reduced-motion` fallbacks required for animation
- Saves at v3, v4, and v5 must keep loading
- Mobile-first: the 320px shell is the design floor

---

## Reference docs (ClickUp)

- [Expanded Vision — Classless Growth, Access, and Obligations](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-14414)
- [Build Changelog](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-14874)
- [Systems & Design Decisions](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-7334)
- [v1.7 Playtest & v1.8 Future Build Ideas](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-15114)
- [Bug Tracker / Known Issues](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-7374)
