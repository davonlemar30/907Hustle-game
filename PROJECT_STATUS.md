# 907Hustle: One Good Run — Project Status

Last updated: 2026-08-05 (America/Anchorage)

## Alpha v0.8 baseline

- Branch: `codex/alpha-v0-8-classless-foundation`, based on merged `main` commit `98c726a` containing PRs #48 and #49.
- New runs are classless: optional Street Name, six attributes at 2, `background: null`, and `streetIdentity: "unproven"`.
- Combat, Charisma, and Intelligence are centralized derived selectors. The 18 former active stat reads now use them.
- A hidden, deduplicated behavior ledger feeds nightly Street Identity evaluation; More → Character displays only qualitative results.
- Legacy Shooter, Hustler, and Strategist saves migrate additively to equivalent attributes while preserving story, dealer, inventory, debt, and relationship state.
- Save schema/key remain version 3 / `907ogr_v3`. Operation Score is unchanged and Street Read remains unimplemented.
- Verification: 88 tests passed; 800/800 simulations completed with zero dead ends. Full results are in `SEVENTH_PLAYTEST_AUDIT.md`.

## Current baseline

- Alpha v0.7.1 playstyle pass is implemented on `claude/907hustle-story-playstyles-d5huyw`, based on merged `main` commit `0e07a00` (PR #46).
- Design target is `VISION.md`; build order is `ROADMAP.md`.
- Active runtime: `index.html`, `v05.css`, `game-core.js`, and `ui.jsx`.
- Save schema/key remain version 3 / `907ogr_v3`. All Alpha v0.7 and v0.7.1 state is additive.
- Decisions and verification are recorded in `SIXTH_PLAYTEST_AUDIT.md`; writing reference in `STORY_BIBLE.md`.
- `events.js`, `script.js`, `style.css`, `combat.js`, and `907hustle/` are legacy and not loaded. See `README.md`.

## Alpha v0.7.1 implementation

1. Kip Sallis is the dealer prototype: one persistent named NPC supporting Buy, Ask, and Rob, so the Hustle and Stickup tracks are legible against the same person. Robbing him pays cash and free product but chokes Spenard supply for two days; two successes put him off the block permanently.
2. `executeDealerRobbery` mirrors `executeRobbery`, including the `suppressStory` tail. The stickup is deliberately not gated by the Quick Score working-capital threshold.
3. Eli, Dre, and Rook chains completed — ten new authored beats. The registry now carries 43 beats across five chains.
4. The registry supports branch stages, so a chain can offer alternative beats at the same point.
5. Place-rooted beats outrank anywhere-beats when the player is standing in that place. This fixed Mara collapsing to 9% once three area-agnostic chains were added.
6. Reactive beats no longer count toward the anti-monopoly streak.

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

- No version bump. `people.dealers`, `run.eventHistory`, `run.lastChainFired`, `run.chainStreak`, `run.lastChainSlot`, `run.lastBeatSlot`, `run.chainBeatsToday`, `run.chainBeatsDay`, `player.streetName`, `player.streetNameChosen`, `people.mara.chainStage`, and `people.mara.jobAtRisk` are additive and fill through `mergeDefaults`.
- Pre-v0.7 and pre-v0.7.1 saves are both constructed and hydrated in `tests/game-core.test.js`. The older one reports `Unnamed run`; the newer one gains an unmet dealer record and a supply factor of 1.
- Existing Mara flag names (`toldMaraTruth`, `usedMaraWithoutConsent`, `maraIntroChoice`) are preserved so v0.6 saves keep their history.

## Verification

### Automated regression suite

Command: `node --test tests/*.test.js`

- **83 passed, 0 failed** (40 at v0.6, 68 at v0.7).
- New `tests/story-chains.test.js` validates registry shape, chain stage continuity, out-of-order unreachability, copy length against the writing standard, preview leakage, determinism, opening variance, the anti-monopoly rule, reactive firing, and cooldowns.

### Deterministic simulation

Command: `node tests/simulate-runs.js 200`

- 800/800 runs terminated across four profiles; 0 dead ends.
- cautious: 8.5 story / 5.0 ambient beats, Mara stage 4+ in 48%, quiet runs 7/200.
- balanced: 8.8 story / 5.9 ambient beats, Mara stage 4+ in 17%, quiet runs 2/200.
- aggressive: 5.6 story / 3.6 ambient beats, Mara stage 4+ in 0%, quiet runs 145/200.
- stickup: 7.7 story / 4.3 ambient beats, Mara stage 4+ in 54% and 6 in 37%, 332 dealer robberies across 200 runs.

The aggressive profile never returns to Spenard, so Mara is structurally unreachable for it — the district gate working as intended. Its quiet count is largely an artifact of the bot spamming Quick Score, which passes `suppressStory: true` and therefore rolls no beat. See `SIXTH_PLAYTEST_AUDIT.md` for the full reading and for two measurement errors corrected during the pass.

## Known limitations

- **Browser and mobile QA has not been run.** The three title tiers are asserted by contract test, not by rendering. A ready-to-run checklist covering ten viewports from 320×568 to 2560×1080, the Tier C fix, and the 390×844 parity check is in `SIXTH_PLAYTEST_AUDIT.md`. It has to be run somewhere with normal internet access: `index.html` loads React, ReactDOM, and Babel from `unpkg.com`, which is blocked in the build environment, so the app cannot boot there at all.
- Mara's true completion rate is unsettled. Simulated bots bracket it between 0% and 64% depending on travel behavior; only human play will settle it.
- React, ReactDOM, Babel, and fonts remain CDN-loaded; runtime Babel is not a production build.
- The packaged title image is still 1.9 MB and should become WebP when an asset pipeline exists.
- Mara is reachable only from Spenard by design. Profiles that never return there reach her 0% of the time; that is the district gate working, but human play should confirm it reads as a choice rather than missing content.

## Next recommended single task

Run the ten-viewport manual browser checklist and the two deliberate v0.8 human flows in `SEVENTH_PLAYTEST_AUDIT.md`, recording identity timing, Character-screen readability, exact save/resume, and identity-aware copy before beginning v0.9.
