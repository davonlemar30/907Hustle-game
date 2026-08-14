# Eighth Playtest Audit — Alpha v0.9

Date: 2026-08-05 (America/Anchorage)

## Outcome

The fresh-arrival build is mechanically complete and automated verification is green. New players can spend Day 1 working, exploring, training, shoplifting, meeting Mina, riding Downtown, browsing property, or discovering gambling and suppliers. Trading is optional. Legacy v3 saves preserve the established garage-first premise and assets.

## Automated results

`node --test tests/*.test.js`: **97 passed, 0 failed**.

`node tests/simulate-runs.js 200`: **2,000 completed, 0 dead ends** across cautious, balanced, aggressive, stickup, legal worker, trader, thief, gambler, trainer, and mixed-freedom profiles.

| Profile | Avg cash | Avg debt | Garage | Avg day | Heat high | Street Read | Identity signal |
|---|---:|---:|---:|---:|---:|---:|---|
| Cautious | $454 | $942 | 0/200 | — | 2 | 2 | Mover 179 |
| Balanced | $360 | $1,028 | 197/200 | 3.2 | 2 | 3 | Earner 128 |
| Aggressive | $100 | $1,182 | 200/200 | 3.0 | 14 | 2 | Wild Card 130 |
| Stickup | $150 | $1,113 | 167/200 | 3.1 | 10 | 2 | Stickup 130 |
| Legal worker | $636 | $0 | 0/200 | — | 2 | 2 | Earner 200 |
| Trader | $455 | $942 | 0/200 | — | 2 | 2 | Mover 179 |
| Thief | $547 | $522 | 0/200 | — | 11 | 2 | Mixed/unproven |
| Gambler | $518 | $702 | 0/200 | — | 2 | 2 | Mixed |
| Trainer | $54 | $1,191 | 0/200 | — | 2 | 2 | Unproven 199 |
| Mixed freedom | $315 | $1,068 | 197/200 | 3.1 | 2 | 3 | Wild Card 163 |

Gambling averaged **−$157** per run. Trainer-only play averaged two attribute gains and could not repay the note. Legal-worker runs repaid it in all 200 seeds. Evictions were 0 in profiles that did not deliberately hide contraband; focused household unit tests cover discovery and eviction. Property was achievable around Days 3–5 and remained optional.

## Story beat audit (43/43)

| Beat | Classification | v0.9 disposition |
|---|---|---|
| mara_intro | Copy rewrite | Actual first meeting; exact three tones |
| mara_shift_change | Compatible | Earned recurring contact |
| mara_invitation | Eligibility change | Garage choice only after acquisition |
| mara_boundary | Copy rewrite | No premature sedan; information boundary |
| mara_sedan_night | Eligibility change | Boundary, continuity, and Curtis pressure 4+ |
| mara_after | Compatible | Existing outcomes preserved |
| eli_offer | Eligibility change | Garage-controlled introduction |
| eli_callback | Compatible | Rejection continuity preserved |
| eli_missed_turn | Compatible | Test-route consequence preserved |
| eli_service_map | Compatible | Trusted route remains earned |
| eli_last_run | Compatible | End-of-week outcome preserved |
| dre_terms | Copy rewrite | $1,000 principal; fixed $1,200 due Day 7 |
| dre_first_payment | Compatible | Partial-payment history preserved |
| dre_due_day | Eligibility change | New Day 7 terms |
| dre_warning | Eligibility change | New due date and balance |
| dre_after_payoff | Compatible | Payoff offer preserved |
| dre_day7 | Compatible | Final accounting preserved |
| rook_mark | Eligibility change | Requires player-created attention |
| early_street | Compatible | Mina-free behavior-created threat |
| rook_tax | Compatible | Pressure chain preserved |
| rook_cut | Compatible | Pressure chain preserved |
| mid | Eligibility change | Garage and earned Curtis continuity |
| rook_day7 | Compatible | Final outcome preserved |
| kip_corner_intro | Eligibility change | Goodie found through exploration |
| kip_retaliation | Compatible | Robbery history preserved |
| kip_recognized | Compatible | Dealer continuity preserved |
| miri_offer | Compatible | Existing contact route preserved |
| tone_offer | Eligibility change | Garage-controlled scene |
| courier | Compatible | Industrial route gate applies |
| base_watch | Eligibility change | Requires garage control |
| crew_crisis | Eligibility change | Owned operation and crew required |
| buyer_hurry | Compatible | Market consequence preserved |
| checkpoint | Compatible | Heat/inventory consequence preserved |
| rough_night | Compatible | Ordinary-life ambient beat |
| wet_bricks | Compatible | Ordinary-life ambient beat |
| door_knock | Eligibility change | Household context respected |
| stranded_wagon | Compatible | Travel ambient beat |
| found_phone | Compatible | Ambient choice preserved |
| careful_customer | Compatible | Market ambient beat |
| dock_shift | Compatible | Legal-work context compatible |
| garage_furnace | Eligibility change | Requires garage control |
| sedan_rumor | Eligibility change | Earned pressure continuity |
| midtown_lights | Compatible | Downtown ambient beat |

No active beat was retired. Garage-free replacements are supplied by home, work, exploration, and street beats rather than duplicate garage scenes.

## Responsive and manual QA

Rendered checks passed at 320×568, 375×667, 390×844, 430×932, 375×560, 768×1024, 1280×800, 1440×900, 1920×1080, and 2560×1080. At each viewport: document width equaled client width, visible buttons were at least 44px high, all four navigation tabs were available, and no console errors appeared. The opening, John question, and Ship Creek action were exercised.

Open, not claimed: three complete seven-day human-style runs (legal, mixed, criminal) and a full rendered save → title → load traversal. Automated save/hydration and exact state checks pass.

## Static checks

`git diff --check` passed. Active `game-core.js` contains no `Math.random`; matches remain only in unloaded legacy `combat.js`, `events.js`, and `script.js`. The two `.DS_Store` changes were not staged. Major activity tests assert exactly one `pipelineAdvances` increment.
