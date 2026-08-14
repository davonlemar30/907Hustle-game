# Alpha v0.9 Copy Review

This register covers player-facing scenes changed for the fresh-arrival premise. Canonical strings remain in `ui.jsx` and `game-core.js`; this records choices, previews, results, effects, flags, callbacks, and author questions.

## Opening — A Spare Room and Seven Days

- Scene: zero-time modal immediately after Street Name confirmation; 88 words.
- Required facts: Alaska restart; Yalonda and John's one-week spare room; John introduced Dre; $1,000 received; fixed $1,200 due Day 7; no negotiation, product, or local name; Day 1 freedom.
- Choice: **Choose how the first Morning goes**.
- Preview/result: **No time passes**; clears `run.openingPending` without changing time or economy.
- Callback: household, Dre, and Places restate only relevant facts.
- Author question: none blocking.

## Mina stage 1 — First Coffee in Spenard

- Scene: actual first meeting at the Night Owl. Neither person implies prior knowledge or routine.
- **Friendly honesty** — preview: tell her you just arrived and keep the first exchange warm. Result: Alaska is a restart; Mina offers bus information. Effects: `maraTrust +1`, `maraFriendlyIntro`, `maraIntroChoice=friendly`.
- **Light flirtation** — preview: let mutual interest show while respecting the counter. Result: brief professional banter and a real smile. Effects: `maraTrust +1`, `maraFlirted`, `maraIntroChoice=flirt`.
- **Brief and guarded** — preview: keep history private and surface-level. Result: correct change, neutral goodnight, no invented familiarity. Effects: `maraDistantIntro`, `maraIntroChoice=distant`.
- Required callback: resolution sets `mara.met` and `maraIntroResolved`; People and the later threat remember the tone.
- Author question: none blocking.

## Mina stage 3 — Four Hours After Close

- Copy change: neither character owns a car; the bus-to-inlet option fits the arrival premise.
- **Take the bus toward the inlet** — preview/result: fare is folded into a quiet evening away from the block. Effects: `maraTrust +2`, Heat −1, `maraDateNight`.
- **Show her the garage** — visible only when `base.controlled`; she sees the operation and is seen near it. Effects: `maraTrust +1`, `maraJobAtRisk`, `maraSawGarage`.
- **Tell her tonight is not good** — preview/result: first raincheck can recur once; second closes it. Effects: `maraRaincheck` or `maraInvitationClosed`.
- Callback: stage 5/6 remembers date, garage exposure, or distance.
- Author question: whether to name Point Woronzof in this scene; the current later callback names it.

## Mina stage 4 — The Question Behind the Store

- Copy change: replaces a premature followed-home sedan with a customer asking for Mina's closing schedule and the player's street name.
- **Tell her everything, risk included** — preview: she receives the whole picture. Result: she records names and claims her own decision. Effects: `maraTrust +2`, `toldMaraTruth`.
- **Give the officer her name** — preview: Heat drops and Mina learns her name was used. Result: attention shifts through her clean name. Effects: `maraTrust −2`, Heat −1, `usedMaraWithoutConsent`.
- **Tell her you can't answer that** — preview: the question remains open. Result: emotional distance without a fabricated threat. Effect: `maraTrust −1`.
- Callback: stage 5 remembers truth, betrayal, date, or the unanswered question; stage 6 preserves established outcomes.
- Author question: confirm whether the officer should ever be identified as John; current copy keeps family separate from this violation.

## Mina stage 5 — Your Pressure Reaches the Night Owl

- Scene: the gray sedan appears only after stage 4, established Mina continuity, and Curtis pressure 4+ created after arrival. The driver watches the player and uses Mina's shift as leverage.
- Choices/previews/results: shared encounter actions—talk, run, pay when affordable, surrender carried product, and weapon-enabled combat—use the established seeded encounter contract.
- Required effects/flags: shared encounter costs and outcomes; `maraSedanNightResolved`; no introduction-time threat flag.
- Callbacks: intro tone changes Mina's signal; truth, betrayal, date, or the unanswered boundary changes the history line.
- Author question: guarded-tone callback says the player “used to leave in a hurry”; consider “left quickly the first night” for the strictest single-meeting language.

## Dre stage 1 — Fixed terms

- Scene: John introduces Dre before playable Day 1. The player receives $1,000 and owes a fixed $1,200 by Day 7; the loan cannot be rejected or renegotiated.
- Choices: no loan-choice branch. The opening has only the zero-time continue action.
- Payment previews/results: $25/$50/$100 increments, safe maximum, full payment, and Street Read recommendation. Every payment is partial-capable and consumes exactly one part of day.
- Required effects/flags: `principal=1000`, `interest=200`, `balance=1200`, `dueDay=7`; payment history and payoff callbacks remain additive.
- Author question: none blocking.
