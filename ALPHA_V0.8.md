# Alpha v0.8: Classless Foundation

Alpha v0.8 removes starting-class selection. A new run begins with an optional Street Name, six equal attributes at 2, no edge, and the Unproven identity. The neighborhood assigns a Street Identity from meaningful play rather than from a creation-screen choice.

## What changed

- New Game now leads to **Start from the Bottom**; a blank name becomes **Rookie**.
- Strength, Endurance, Reflexes, Presence, Insight, and Discipline are stored on the player.
- Combat, Charisma, and Intelligence are centralized derived ratings. A new character derives 2/2/2.
- Meaningful sales, payments, confrontations, recruiting, contact work, and investments feed a hidden, deduplicated ledger.
- Nightly evaluation can assign The Mover, The Earner, The Stickup, The Connector, or The Wild Card. A replacement needs a 25% lead, a margin of 3, and two consecutive nights.
- More → Character shows identity, attributes, derived ratings, and five qualitative reputation notes without score math.
- Mina, Eli, Dre, Curtis, Goodie, one ambient scene, encounter previews, and the Day 7 summary recognize the current identity without changing relationship state or base effects.

## Save compatibility

The save key remains `907ogr_v3` and the schema version remains 3. Shooter, Hustler, and Strategist saves retain their history in `legacyBackground` and migrate additively to attribute spreads deriving approximately 3/1/2, 1/3/2, and 2/1/3. Their story, inventory, debt, dealer, and relationship records remain intact. A legacy edge is shown only as save history, never as a current class.

## Verification

- `node --test tests/*.test.js`: 88 passed, 0 failed.
- `node tests/simulate-runs.js 200`: 800/800 completed, 0 dead ends.
- All new simulated characters derived 2/2/2; the legacy Shooter smoke check derived 3/1/2.
- Identity results: cautious 106 Connector / 75 Wild Card; balanced 130 Wild Card / 49 Earner; aggressive 74 Earner / 57 Wild Card / 32 Stickup / 36 Unproven; stickup 165 Stickup / 30 Wild Card. Remaining counts were small cross-style outcomes.

## Playtest targets

The title, Street Name confirmation, classless start, Character screen, and exact save/return/load flow were exercised in the in-app browser. All ten specified viewports reported no horizontal overflow, visible controls stayed at least 44px, and the console stayed clean. Full mixed and stickup seven-day human runs, including every Goodie action and a naturally emerging identity, remain open.

## Deferred

Street Read XP, proficiency growth, jobs, gym/training, dice, shoplifting, bus travel, vehicles, jail, multiple lenders, persistent meta-progression, and continuation after Day 7 remain planned for v0.9 or later.
