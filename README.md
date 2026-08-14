# 907Hustle: One Good Run

907Hustle is a mobile-first, single-player crime, trading, relationship, and light-RPG web game set in an Anchorage-inspired Spenard. A run follows a newcomer balancing clean work, street income, debt, family housing, friendships, rivals, crew, and territory across a dynamic Week Zero.

The current playable build is **v1.8: Character, Relationship, and Hustle Rework**.

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

No build step is required. Serve the repository over HTTP and open `index.html`:

```bash
python3 -m http.server 8000
```

The active build is:

```text
index.html
  ├── v05.css
  ├── game-core.js
  ├── encounters.js
  └── ui.jsx
```

Run the automated checks with:

```bash
node --check game-core.js
node --check encounters.js
node --test tests/*.test.js
node tests/simulate-runs.js --total 2000
git diff --check
```

## Verification

- Node tests: **337 passing**
- Deterministic simulations: **2,000 runs, zero crashes or dead ends**
- Simulation SHA-256: `5890e37a3c039d4929fa59273857ec528b2a929c2de3cd4a7d2dbb7f895a6b76`
- Viewports: 320×568, 375×667, 390×844, 430×932, 375×560, and 1280×800
- Browser criteria: zero console errors, zero horizontal overflow, usable Phone/Hustle locked states, correct five-tab navigation, and 44px controls

## Documentation

- [STORY_BIBLE.md](STORY_BIBLE.md) — current character voices, relationship rules, and story continuity
- [VISION.md](VISION.md) — long-form design direction
- [ROADMAP.md](ROADMAP.md) — release history and future work
- [PROGRESSION_DESIGN.md](PROGRESSION_DESIGN.md) — progression and identity model

The ClickUp v1.8 specification is the release source of truth: [v1.8 Character, Relationship, and Hustle Rework](https://app.clickup.com/90141007990/v/dc/2kyd583p-4054/2kyd583p-15114).

The draft pull request link will be added here after publication.
