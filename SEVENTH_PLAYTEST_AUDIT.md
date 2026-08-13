# Seventh Playtest Audit — Classless Foundation

## Baseline verification

Branch `codex/alpha-v0-8-classless-foundation` was created from `origin/main` at `98c726a`, including PRs #48 and #49. Before changes, 83 tests passed and 800/800 simulations completed with zero dead ends. The two pre-existing `.DS_Store` modifications were left untouched and excluded.

## Implementation audit

- Character creation was one `CHOOSE_BACKGROUND` reducer branch and one `EdgeScreen`; Street Name was already sanitized to 16 approved characters and used at six established surfaces.
- `player.background` was written at creation and inspected by compatibility tests; active gameplay did not branch on it.
- Eighteen active reads of Combat, Charisma, or Intelligence existed in trade, recruitment, territory estimation, robbery, dealer robbery, crew routes, encounter availability/resolution, and Eli's route.
- Hydration used recursive additive `mergeDefaults`. The UI displayed the edge only during creation. Simulations selected a legacy background per profile.

## Migration and behavior

Combat is `round(Strength × .40 + Reflexes × .35 + Endurance × .25)`. Charisma and Intelligence are `round(Presence or Insight × .70 + Discipline × .30)`. Legacy mappings preserve Shooter 3/1/2, Hustler 1/3/2, and Strategist 2/1/3. All active reads use centralized selectors.

| Category | Implemented meaningful sources |
| --- | --- |
| Mover | qualifying profitable sales, fair Kip purchases, market information, Kip choices |
| Earner | Dre and crew payments, safehouse or neighborhood investment, final plan, Dre choices |
| Stickup | Rob, dealer robbery, confrontation, intimidation, territory attack, Rook choices |
| Connector | relationship choices, recruitment, Eli test route, Mara and Eli choices |

Sources are deduplicated, repetitive sources are capped, and history is bounded to 50. Navigation, quantity changes, and invalid actions record nothing.

## Identity rules and content

The first evaluation occurs after Day 2 Night with six meaningful actions, or immediately at eight actions if that window was missed. Close leaders produce Wild Card. Later changes require a 25% lead, a raw margin of 3, and the same candidate across two nights. Variations appear in Mara, Eli, Dre, Rook, Kip, one ambient scene, encounter previews, and the ending summary. Effects and relationship meters remain separate.

## Verification results

88 tests pass. All 800 simulations terminate with zero dead ends. Mean first assignment day was 4.0 cautious, 4.0 balanced, 3.2 aggressive, and 3.7 stickup. Identity changes totaled 115, 80, 22, and 70. Only 36 aggressive runs remained Unproven. Meaningful-action averages were 16.6, 14.7, 9.2, and 15.8.

## Manual QA and limitations

Partial browser QA passed. The packaged title, New Game, optional Street Name, Start from the Bottom, Character screen, and exact save → title → load flow were exercised. At 320×568, 375×667, 390×844, 430×932, 375×560, 768×1024, 1280×800, 1440×900, 1920×1080, and 2560×1080 there was no horizontal overflow; the smallest visible control measured 44px. All six attributes and derived ratings rendered, the title and Character layouts were visually inspected, and no console errors were captured. A duplicated Unproven description found during the pass was removed.

The two complete human-style mixed and stickup runs remain open, so naturally timed identity announcements, all Kip actions in one manual session, and full seven-day story coherence are not claimed as manually passed. Aggressive simulations often finished Earner or Wild Card because investments and Dre choices also mattered; the dedicated stickup profile strongly favored Stickup (165/200), demonstrating behavior rather than profile hard-coding.

Street Read, attribute improvement, jobs, training, gambling, shoplifting, transportation, jail, multiple lenders, continuation, proficiencies, and meta-progression remain deferred.
