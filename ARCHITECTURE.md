# ARCHITECTURE

How 907Hustle: One Good Run is put together, current as of **v1.8.1**.

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
  items.js            GEAR, BASE_UPGRADES, LISTING_ITEMS + lookups
  jobs.js             SPENARD_JOBS, JOB_APPROACHES, JOB_RANK_THRESHOLDS, STARTER_JOB_IDS
  npcs.js             CREW, DEALERS, PLUGS, HOUSEHOLD_NPCS, NIGHT_OWL_REGULARS + lookups

src/events/
  registry.js         ENTITY_REGISTRY, ENTITY_MATCH_ORDER, EVENT_FLAVOR, EVENT_CONTEXT, AMBIENT_FLAVOR
  cards.js            event(), effectPreview(), activeEvent() — every event card
  random.js           Seeded RNG + isEligible() / getWeight()

src/selectors.js      Tiny pure reads shared by game-core and src/events

tests/                node --test, no runner config
  simulate-runs.js    Seeded whole-run simulator (not a test; a harness)
```

**`game-core.js` is a barrel.** It requires from `src/` and re-exports through one
`api` object. Its export shape is a contract: `ui.jsx` and every test read it.

### Where do I put a new thing?

| Adding | Goes in |
|---|---|
| A story beat / character arc card | `src/events/cards.js` + a descriptor in `STORY_REGISTRY` |
| A new NPC | `src/data/npcs.js`, plus state in `createNpcState()` |
| A new job | `src/data/jobs.js` |
| A product, district, or gear item | the matching `src/data/` file |
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

`SAVE_KEY = "907ogr_v5"`, `VERSION = 5`, `LEGACY_SAVE_KEYS = ["907ogr_v4", "907ogr_v3"]`.

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
  `checkpointDay`, `pendingEvent`, `eventHistory`, `recentEvents`
- `player` — `cash` / `dirtyCash` / `cleanCash` (money is split by provenance),
  `heat`, `health`, `energy`, `attributes`, `streetIdentity`
- `npc` — `yalonda`, `juan`, `mina`, `curtis`, `dre`, `simone`
- `people` — `household`, `crew`, `dealers`

### Migration rules

- **Additive only.** Never remove or repurpose a field; add a new one.
- `migrateSave(value)` accepts versions **3 and 4** and returns `null` for
  anything older or malformed. `hydrateRun` fills defaults via `mergeDefaults`.
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

## System connections

Audited in v1.8.1. Line numbers are `game-core.js` unless noted, and drift.

| Connection | State | Evidence |
|---|---|---|
| Phone off → missed events | **Wired** | `pushPhoneMessage` only delivers when `phone.active` (:463); job callbacks stall (:472); story cards gate on it (:3003, :3011, :3013); unpaid bill cuts service (:2706) |
| Yalonda trust → housing | **Wired** | rent due (:4463); `householdWarning` accumulates (:3333); 3 warnings ⇒ `evicted` + `endRun` (:3336) ⇒ `nowhere_to_go` ending (:3303) |
| Juan trust → lead quality | **Wired** | `juanWorkIntelKnown` (:1752) unlocks the `ship_creek` job (:1913); trust gates the Dre route (:2418) and two story cards (:3003, :3011) |
| Consequence cards → phone / day log | **Wired** | `logEntry` (:452), `pushConsequence` (:456), `pushPhoneMessage` (:461) |
| Heat → encounter frequency | **Wired, not via weightedPick** | ambient chance carries `+ heat * 0.01` (:3156); police/rival cards gate on heat (:3033 `heat >= 5`, :2933 `heat >= 10`); block raids scale with `RAID_HEAT_WEIGHT` (:2607). Heat is **not** a term in `getWeight` |
| Reputation → vendor pricing | **Partial, under other names** | there is no `reputation` stat. `tradeUnitPrices` moves the sell price by charisma, district `influence`, Curtis friendship, Pherris tier, and territory control |
| Heat → job consequences | **Absent** | there is no job-loss mechanic of any kind, and heat never reaches the jobs system. Note the spec's ">60" is unreachable: **heat is clamped 0–15** (`heatBand`: warm 4, high 8, critical 12, run ends at 15) |
| Bank interest → daily tick | **Absent** | there is no bank. `base.storedCash` / `home.storedCash` are storage only — deposit and withdraw, no accrual. The only compounding interest is debt (`lender.interestMultiplier`) |

The last three are **design gaps, not broken wiring**. Building them is new
gameplay and belongs in a build that expects balance to move.

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
npm test                              # 345 tests
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
Nothing in the run path may use `Math.random()` — only `makeRandom(seed)`.

The simulator plays eleven strategies (cautious, balanced, aggressive, stickup,
legal_worker, trader, thief, gambler, trainer, mixed_freedom, operator) and
reports endings, economy, story beat counts, identity assignment, and dead ends.

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
- Saves at v3 and v4 must keep loading
- Mobile-first: the 320px shell is the design floor

---

## Reference docs (ClickUp)

- [Expanded Vision — Classless Growth, Access, and Obligations](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-14414)
- [Build Changelog](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-14874)
- [Systems & Design Decisions](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-7334)
- [v1.7 Playtest & v1.8 Future Build Ideas](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-15114)
- [Bug Tracker / Known Issues](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-7374)
