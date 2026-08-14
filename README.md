# 907Hustle: One Good Run

907Hustle is a mobile-first, single-player crime, trading, relationship, and light-RPG web game set in an Anchorage-inspired Spenard. A run follows a newcomer balancing clean work, street income, debt, family housing, friendships, rivals, crew, and territory across a dynamic Week Zero.

The current playable build is **v1.9a: Exposure System and Bug Fixes**.

New here? Read [ARCHITECTURE.md](ARCHITECTURE.md) — file map, state shape, event
card schema, and the rules a change has to hold to.

## What changed in v1.9a

**Relationships stopped being progress bars.** Every NPC used to carry a flat
integer — `mina.trust`, `curtis.attention`, `dre.trust` — with no shared meaning
between them. Two players sitting at the same number by completely different
routes unlocked exactly the same content.

Now each NPC keeps a **ledger** of typed observations, reads it through a
personality **lens**, and their disposition is derived rather than stored.

- **Eleven observation categories.** Presence, honesty, violence, financial,
  heat exposure, loyalty, betrayal, discretion, growth, submission, defiance.
  Repeats merge into a count instead of piling up rows.
- **Four archetypes, per-character overrides.** Mina reads consent and safety and
  weighs what her network tells her twice as heavily as what she watches happen.
  Dre reads follow-through. Yalonda reads whether rent landed. Curtis is
  **inverted**: everything that makes you worth noticing makes him more of a
  problem, which is why he reads Neutral as invisible and Hostile as the tax.
- **Gossip travels.** Five channels decide who hears what and when. A robbery two
  blocks from the Night Owl reaches Mina if she is behind the counter that
  evening, and may never reach her at all if she is not. Curtis's network runs
  through a filter: corner-level activity stays below his radar.
- **Heat is public.** Above 8 it reaches the household, above 10 the
  neighborhood, above 12 the network. This closes a connection the v1.8.1 audit
  filed as absent.
- **Grinding does not work.** Repeated behavior follows `min(4, log2(count + 1))`.
  The clamp is the important half: `log2` alone never stops climbing, so without
  it a patient player reaches the top band by doing one thing forever. Betrayal
  never fades, and a missed obligation gets worse every time.
- **Six shared bands** replace every per-character threshold: Hostile, Cold,
  Neutral, Warm, Trusted, Bonded.

**Two blockers fixed.** Neither was what the report described:

- Starting without a name was never missing validation. The gate existed at both
  layers, but the Start control uses `.edge-card` and the stylesheet had no
  disabled rule for that class, so a blocked button looked live and taps did
  nothing. It now dims, says why, and takes Enter.
- Downtown was one-way because the destination list filtered out the *home*
  district rather than the district you are standing in. The $5 ride home already
  worked in the reducer; nothing but that one line stranded the player. The
  outbound bus leg also debited cash without touching the dirty/clean split, so a
  round trip left the two disagreeing.

**Saves are v6.** v3, v4, and v5 all migrate, and pre-Exposure relationships
convert into ledger entries rather than being thrown away.

**Gameplay changed on purpose,** so the simulation hash moved. The new 2,000-run
baseline is `3e0b84f6d2856ddf292eed0aadeb5a5e8d46540ef215d8ac3d8efb30590453f1`.
Overall economy sits within 3.3% of v1.8.1 and 2,000 seeded runs finish with zero
dead ends.

## What changed in v1.8.1

A structural pass. **No gameplay changed**: a 200-run seeded simulation hashes
identical to v1.8, which is the check that nothing the player can see moved.

- **Runtime Babel is gone.** JSX was compiled in the browser by
  `@babel/standalone` on every load. `npm run build` now bundles with esbuild in
  about 20ms, and React switched to its production builds. This also removes the
  class of bug behind the v1.6 `playSound` crash: under Babel every top-level
  declaration became a `window` property, and inside the bundle they are
  module-scoped.
- **The title art is 96.5% smaller on phones.** The 1.9MB PNG is now served as
  WebP through `<picture>`: 68KB at 600px and under, 145KB above. The PNG
  remains as a fallback.
- **`game-core.js` split from 499KB to 371KB.** Product, district, job, item,
  NPC, and event-card definitions moved into `src/data/` and `src/events/`.
  `game-core.js` stays the barrel and its exported shape is unchanged.
- **One event gate.** Card eligibility and weighting moved into
  `isEligible()` / `getWeight()`, and all 60 story descriptors are now checked
  against a schema by a test.
- **~11MB of dead files deleted**: `script.js`, `events.js`, `combat.js`, and
  `style.css` were unreferenced, and `907hustle/` was an old prototype holding
  the same 5.5MB image twice.
- **The character renames are locked in.** A test fails if `rook`, `mara`,
  `kip`, or `miri` appears anywhere outside `migrateSave`, which still needs them
  to load old saves.

## What changed in v1.8

### Characters and relationships

- **Mina Vale** has a six-scene Night Owl arc: *First Coffee*, *Twenty Minutes Past Close*, *Four Hours and No Agenda*, *Someone Said Your Name Wrong*, *The Vale Call*, and *Aftermath*. Her trust changes dealer pricing, daily intelligence, broker texts, the Kieran Vale confrontation, and the outcomes `mina_stays`, `mina_calls_home`, or `mina_gone`.
- **Curtis Foyer** reacts to concrete exposure instead of generic Respect. Attention rises from cumulative sales, rolling illegal revenue, conspicuous Spenard business, reports, and network escalation. Tax, friendship, guarded independence, rejection, betrayal, protection, and truce paths are all persistent.
- **Dre Smooth** is no longer required to end Week Zero. Juan or a missed phone bill can introduce him; repeat loans, four mission types, relationship tiers, five backstory fragments, and the Shark lending track deepen his route.
- **Goodie** is a dealer only. His standing, discounts, rumors, supply retaliation, robbery history, and disappearance limit remain; the finance-lieutenant and laundering progression has been removed.
- **Pherris Dickens** grows from a paid rumor source into a social territory manager and seeded network-income operator.
- **Simone Hart** is Curtis's independent partner, with her own trust, threat, leverage, and truce state.
- **Tone** gains territory-defense tiers and the Day 7+ Jacksonville chain.
- **Deshawn** is recruitable through an intact Goodie relationship or restitution. His higher tiers reduce recruiting costs, broker truces, and can stop Curtis's betrayal.

Legacy aliases remain only in migration code and fixtures; player-facing copy uses the v1.8 identities throughout.

### Hustle and lending

The unified Hustle record tracks Market, Boost, Stickup, and Shark visibility, illegal revenue history, Curtis exposure, and loan-shark state.

- Hustle unlocks after the first successful dirty-income action.
- A discovered Street Market remains available through Street before that unlock, so the first sale cannot deadlock.
- Market-session completion, robbery attempts, and boost attempts consume time.
- Shark unlocks after Dre trust 3, three clean missions, and two repaid Dre loans.
- Nora Pike, Jamal Briggs, Kelsey Roy, and Leon Grant have distinct limits and qualitative risk.
- Shark terms support $100, $250, and $500 principals and 2-, 4-, and 7-day durations where allowed.
- Defaults are deterministic from borrower risk, amount, deadline, Insight, and Dre mentorship. Collection, extension, enforcement, and forgiveness create different time, Heat, and relationship consequences.

### Jobs and time

- Multiple applications may mature simultaneously into explicit offers.
- Only one employer can be active. Accepting another offer quits the current employer and resets that employer's XP, rank, and coworker relationship while preserving discovered details and history.
- Day Labor is always available and does not count as a held job.
- Mina leaving does not remove an already-earned Night Owl position.
- Time cost is centralized. Travel, exploration, shifts, applications, dates, missions, completed market sessions, robbery/boost attempts, training, gambling, takeovers, claims, garage visits, treatment, sleep, and final plans advance time.
- Phone use, payments, Goodie interactions, local conversations, immediate first aid, 907List transactions, recruitment, assignments, equipment, and upgrades are free.
- Free actions can show consequences but do not roll story progression or advance automatic timers.

## Navigation

The fixed bottom rail contains five destinations:

1. **Home** — household, immediate obligations, and the current situation.
2. **Street** — destinations, local places and activities, People, and the pre-unlock Street Market.
3. **Hustle** — Market, Boost, Stickup, and Shark; hidden until dirty income first succeeds.
4. **Phone** — always present. Inactive service shows No Service and walk-in restoration directions.
5. **More** — finances, operations, recovery, character, Street Read, history, and help.

All primary controls target a minimum 44px touch area. The shell is designed for 320px-wide phones through desktop layouts without horizontal overflow.

## Core systems

- Four-part days: Morning, Afternoon, Evening, and Night
- Dynamic checkpoint rather than a forced literal seven-day ending
- Seeded market prices, inventory, weighted cost basis, rumors, and buyer modifiers
- Dirty and clean cash with the invariant `cash = dirtyCash + cleanCash`
- Phone and rent obligations, household trust, jobs, callbacks, and 907List
- Heat, Health, Recovery, equipment, garage upgrades, crew, soldiers, Respect, and territory
- Data-driven seeded stories, encounters, missions, and borrower outcomes
- Autosave, title screen, run restart, save preview, and exact resume

## Save compatibility

v1.8 saves use schema version **5** and local-storage key `907ogr_v5`.

The loader continues to read `907ogr_v4` and `907ogr_v3` once, migrate them to v5, and preserve:

- completed relationship stages, choices, and outcome history
- Curtis attention/respect and renamed territory ownership
- Goodie's dealer standing and robbery history, without laundering access
- Pherris recruitment and loyalty
- crew, blocks, cash classifications, completed runs, and pending state
- the last-worked eligible employer as the active job; other prior employers become offers without losing their records

Migration preserves already-clean cash and removes only future laundering actions. Renamed events are marked as already resolved so they do not replay.

## Development

There is a build step as of v1.8.1. Install once, then build:

```bash
npm install
```

```bash
npm run build
```

Serve the repository over HTTP and open `index.html`:

```bash
python3 -m http.server 8000
```

The active build is:

```text
index.html
  ├── v05.css
  ├── react / react-dom (UMD, production, from unpkg)
  └── ui.built.js          ← esbuild output, committed
        ├── game-core.js   ← barrel over src/
        ├── encounters.js
        └── ui.jsx
```

**`ui.built.js` is committed on purpose.** GitHub Pages serves this repo directly
with no CI, so the bundle has to be in the repo. Rebuild and commit it with any
change to `ui.jsx`, `game-core.js`, `encounters.js`, or `src/`.

Run the automated checks with:

```bash
npm test
```

```bash
node tests/simulate-runs.js --total 2000
```

To prove a refactor changed no behavior, compare the seeded simulation hash
before and after:

```bash
node tests/simulate-runs.js --total 200 | shasum -a 256
```

## Verification

- Node tests: **345 passing**
- Deterministic simulations: **2,000 runs, zero crashes or dead ends**
- Simulation SHA-256: `5890e37a3c039d4929fa59273857ec528b2a929c2de3cd4a7d2dbb7f895a6b76`
  — **unchanged from v1.8**, which is the proof that the v1.8.1 refactor moved
  no behavior
- Build: `npm run build` completes in ~20ms with no circular imports
- Title art over the wire: 68KB at 375px, 145KB at 1280px, down from 1,976KB
- Viewports: 320×568, 360×640, 375×812, 414×896, 640×480, 768×1024, 834×1112,
  1024×768, 1280×720, and 1440×900 — all with zero horizontal overflow and no
  tap target under 44px
- Browser criteria: zero console errors, usable Phone/Hustle locked states,
  correct five-tab navigation, and no Babel in the page

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — file map, state shape, save migration, event card schema, and the constraints a change has to hold to. Start here.
- [STORY_BIBLE.md](STORY_BIBLE.md) — current character voices, relationship rules, and story continuity
- [VISION.md](VISION.md) — long-form design direction
- [ROADMAP.md](ROADMAP.md) — release history and future work
- [PROGRESSION_DESIGN.md](PROGRESSION_DESIGN.md) — progression and identity model

The ClickUp v1.8 specification is the release source of truth: [v1.8 Character, Relationship, and Hustle Rework](https://app.clickup.com/90141007990/v/dc/2kyd583p-4054/2kyd583p-15114).

Implementation: [draft PR #65](https://github.com/davonlemar30/907Hustle-game/pull/65).
