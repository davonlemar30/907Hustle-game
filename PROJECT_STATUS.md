# 907Hustle: One Good Run — Project Status

Last updated: 2026-08-03 (America/Anchorage)

## Current baseline

- Alpha v0.7 story pass is implemented on `claude/907hustle-story-playstyles-d5huyw`, based on merged `main` commit `0e07a00` (PR #46).
- Active runtime: `index.html`, `v05.css`, `game-core.js`, and `ui.jsx`.
- Save schema/key remain version 3 / `907ogr_v3`. All Alpha v0.7 state is additive.
- Decisions and verification are recorded in `SIXTH_PLAYTEST_AUDIT.md`; writing reference in `STORY_BIBLE.md`.
- `events.js`, `script.js`, `style.css`, `combat.js`, and `907hustle/` are legacy and not loaded. See `README.md`.

## Alpha v0.7 implementation

1. The linear `scheduleStory` ladder is replaced by `STORY_REGISTRY`: 30 declarative descriptors carrying chain, stage, classification, trigger tier, gating, cooldown, weight, and an exit condition.
2. Selection runs in three tiers. `reactive` beats fire on their cause; `chain` beats roll at 0.30 with a +0.16 pity bonus; `ambient` beats use the existing risk formula plus a +0.16 quiet-week bonus. Opening variance measures 26 of 30 distinct sequences across seeds, against exactly one under v0.6.
3. An anti-monopoly filter drops a chain from the pool after two consecutive beats whenever anything else is eligible, and `STORY_BEATS_PER_DAY` caps the week at two story beats per day.
4. Mara has a six-stage arc with a want independent of the player (a Ship Creek dispatch job that public association with the operation would cost her), an optional evening, a boundary scene gated on trust, a threat, and an aftermath that branches on treatment.
5. The Day 2 threat is now always the Mara-free `early_street`. Her sedan encounter moved to stage 5, Day 5 onward, so the run no longer endangers her before the player has context.
6. Three Day 7 Mara outcomes: `mara_escape`, the new `mara_clear` (she takes the Monday interview and you go your own way — a separation, not a failure), and the new `mara_gone`.
7. Nine repeatable one-off street events were added, five of which involve no criminal transaction.
8. A copy audit scored all 20 active beats against the Task 7A standard; all 14 inherited v0.6 events failed on description and result length and were rewritten. Effects, flags, and gating are unchanged.
9. An optional Street Name is offered before edge selection: 16 characters, sanitized to `[A-Za-z0-9 '-.]`, with an edge-derived default when skipped and exactly six approved usage sites.
10. `End Market` became `Finish Trading` with a sub-label naming the part of day it advances to. Nine further player-facing strings were rewritten; `Lay Low` is unchanged.
11. The title screen gained three aspect-ratio tiers. The portrait tier is byte-identical to v0.6; wide viewports switch to `contain` over a blurred self-backdrop instead of discarding ~65% of the artwork.

## Architecture

`Title/save inspection → createRun or hydrateRun → React useReducer → reduceGame → single advanceRun pipeline → scheduleStory → v3 autosave`

`game-core.js` remains a UMD domain module exposed as `window.GameCore` and `module.exports`. The story registry, chain definitions, and three-tier selector live in the core alongside markets, contacts, encounters, and endings. `ui.jsx` remains presentation only and renders no registry metadata.

All time-consuming actions still route through `advanceRun` exactly once. Story beats are delivered at the end of an advance that has already ticked, so resolving an event never adds a second tick.

## Save compatibility

- No version bump. `run.eventHistory`, `run.lastChainFired`, `run.chainStreak`, `run.lastChainSlot`, `run.lastBeatSlot`, `run.chainBeatsToday`, `run.chainBeatsDay`, `player.streetName`, `player.streetNameChosen`, `people.mara.chainStage`, and `people.mara.jobAtRisk` are additive and fill through `mergeDefaults`.
- A pre-v0.7 save is constructed and hydrated in `tests/game-core.test.js`; its preview reports `Unnamed run` and the run continues to play.
- Existing Mara flag names (`toldMaraTruth`, `usedMaraWithoutConsent`, `maraIntroChoice`) are preserved so v0.6 saves keep their history.

## Verification

### Automated regression suite

Command: `node --test tests/*.test.js`

- **68 passed, 0 failed** (was 40).
- New `tests/story-chains.test.js` validates registry shape, chain stage continuity, out-of-order unreachability, copy length against the writing standard, preview leakage, determinism, opening variance, the anti-monopoly rule, reactive firing, and cooldowns.

### Deterministic simulation

Command: `node tests/simulate-runs.js 200`

- 600/600 runs terminated; 0 dead ends.
- cautious: 7.1 story / 5.2 ambient beats, Mara stage 4+ in 42%, quiet runs 9/200.
- balanced: 6.8 story / 6.6 ambient beats, Mara stage 4+ in 22%, quiet runs 7/200.
- aggressive: 4.3 story / 3.7 ambient beats, Mara stage 4+ in 0%, quiet runs 161/200.

The aggressive profile never returns to Spenard, so Mara is structurally unreachable for it — the district gate working as intended. Its quiet count is largely an artifact of the bot spamming Quick Score, which passes `suppressStory: true` and therefore rolls no beat. See `SIXTH_PLAYTEST_AUDIT.md` for the full reading and for two measurement errors corrected during the pass.

## Known limitations

- **Browser and mobile QA has not been run.** The three title tiers are asserted by contract test, not by rendering. Ten viewports from 320×568 to 2560×1080 need checking before this build is called verified.
- Mara's true completion rate is unsettled. Simulated bots bracket it between 0% and 64% depending on travel behavior; only human play will settle it.
- The planned `stickup` simulation profile was dropped because Kip Sallis is deferred to v0.7.1.
- React, ReactDOM, Babel, and fonts remain CDN-loaded; runtime Babel is not a production build.
- The packaged title image is still 1.9 MB and should become WebP when an asset pipeline exists.
- Eli, Dre, and Rook have registered chains with only 2–3 stages each; Kip's chain is registered but unpopulated.

## Next recommended single task

Run the browser and mobile QA pass that this build did not: the three title tiers at 320×568, 375×560, 375×667, 390×844, 430×932, 768×1024, 1280×800, 1440×900, 1920×1080, and 2560×1080, confirming zero horizontal overflow, 44px minimum controls, that the 390×844 title screen is unchanged from v0.6, and that the desktop tier shows the full artwork without bars. Then play two human runs — one staying in Spenard, one travelling constantly — to settle Mara's real frequency before starting v0.7.1.
