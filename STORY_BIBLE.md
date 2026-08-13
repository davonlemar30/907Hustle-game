# 907Hustle: One Good Run — Story Bible

## Alpha v0.9 continuity rules

- Fresh runs begin at Yalonda and John's home. John has already introduced Dre, but no other local relationship is established.
- Mara is a stranger until the player voluntarily visits the Night Owl. Her first-meeting tones are Friendly honesty, Light flirtation, and Brief and guarded.
- A sedan cannot appear in Mara's introduction or boundary scene. `mara_sedan_night` requires her stage-4 continuity plus player-created Rook pressure of at least 4.
- Rook begins unaware with zero pressure. Kip begins unknown and is discovered through Explore Spenard.
- Garage scenes require `base.controlled`. Legacy v3 saves may begin with that continuity because hydration preserves their established premise.
- Yalonda and John are recurring People, not menu exposition. Household warnings and eviction can produce the `Nowhere to Go` ending.

The full 43-beat classification is in `EIGHTH_PLAYTEST_AUDIT.md`; changed scene copy and callbacks are in `COPY_REVIEW.md`.

Writer-facing reference for Alpha v0.9. Everything here describes the **active
runtime** (`index.html` → `v05.css`, `game-core.js`, `ui.jsx`). The 42 events in
`events.js` are not loaded and are not canon.

---

## Street Identity voice guidance

Street Identity changes interpretation, not personality or relationship truth. Mara notices safety and consent, Eli routes and people, Dre dates and follow-through, Rook pressure, and Kip business and threat. Avoid repeating the full identity label, exposing score math, or treating identity as a permanent class. Unproven copy must remain coherent.

Variations currently appear in `mara_intro`, `eli_offer`, `dre_terms`, `rook_mark`, `kip_corner_intro`, `sedan_rumor`, `dre_day7`, encounter previews, and the Day 7 summary. Mara trust, Dre trust, Rook respect, dealer standing, and crew loyalty remain separate character state.

## 1. Writing standard

**Point of view.** Second person, present tense, throughout descriptions and
results. No drifting into first person or detached narration.

**Every scene carries four layers, in order:**

1. **Concrete opening image** — a visible action, object, vehicle, room, sound,
   or piece of weather.
2. **Immediate situation** — what is happening now and why a decision is due.
3. **Character or world pressure** — what the other person wants, fears, hides,
   or stands to lose.
4. **Decision point** — the specific thing the player controls.

Never open with an abstract summary ("An opportunity appears", "Things are
getting dangerous"). If the first sentence could belong to any event, it is wrong.

**Length targets** (enforced by `tests/story-chains.test.js`):

| Element | Target |
|---|---|
| Title | 2–6 words |
| Who / Where | one line each |
| Description | 45–90 words |
| Stakes | 12–28 words |
| Choice label | 2–7 words |
| Choice preview | 8–24 words |
| Result | 25–70 words |

A scene may run long when the extra length carries dialogue, character, or a
reveal. Routine events stay inside the ranges.

**Choices** describe what the player does or says — "Buy two and check the
seals", not "Take the risk". Every multi-choice scene needs at least two
credible options; never one correct answer surrounded by punishment buttons.

**Previews** name the category of consequence and nothing more. No percentages,
no trust values, no stage numbers, no chain names. "Costs $60. Mara accepts the
help and sets the terms you did not ask for" — not "This may matter later."

**Results** show what visibly happened, state the mechanical consequence in
plain language, and leave one concrete detail a later scene can reach for.

**Do not** repeat the same stakes across description, preview, and result.

---

## 2. Voice guide

**Mara Velez** — Observant, concise, hard to impress. Direct when safety or work
is involved. Warmth shows through remembered details and practical action, never
through declarations. She names boundaries plainly and can leave without becoming
cruel. Avoid romantic exposition and instant openness.

**Eli "Shortcut" Ward** — Talks in routes, timing, exits, vehicles, distances.
Eager to be useful; covers insecurity with excess practical detail. Responds hard
to being trusted with responsibility. Rejection makes him guarded, not hostile.

**Dre Holloway** — Calm, controlled, attentive to dates and amounts. Rarely
threatens. Applies pressure through silence, revised terms, and access. Respects
payment over promises. Debt should feel personal without every scene turning
violent.

**Rook Mercer** — Territorial and strategic. Treats the player as a developing
problem. Works through other people, rumors, blocked access, and public
embarrassment; direct violence arrives only after lesser pressure fails. His
scenes should show that he has been tracking behavior.

**Kip Sallis** — Social, opportunistic, alert to shifts in standing.
Acts casual while reading weapons, crew, cash, and confidence. Remembers whether
he was dealt with fairly before he was robbed. Never a disposable target.

**Miri Cole** — Information-focused, protective of her network. Distinguishes
rumor from confirmation from opinion. Wants credit and ownership over the
contacts she supplies. *(Canonical name: Miri Cole. The "Mina Vale" entry in the
ClickUp Characters page is retired.)*

**Anton "Tone" Bell** — Direct, restrained, experienced with physical risk.
Speaks in practical assessments. Values preparation and stated limits. Dislikes
reckless violence that creates exposure.

---

## 3. Seven-day rhythm

| Day | Intent |
|---|---|
| 1 — Orientation | Edge, debt, district, first trade. At most one recurring character. No major threats. |
| 2 — Contact | A grounded local connection. One consequence of opening behavior. Room for an ambient beat. |
| 3 — Opportunity | A route, relationship, supply, or crew opening. Dre or Rook pressure begins as a specific signal. |
| 4 — Payment and boundaries | Dre's due date lands. Contacts ask the player to define terms. Early shortcuts start costing. |
| 5 — Consequences | Retaliation, surveillance, supply loss. Connected beats read earlier flags. Ambient still appears. |
| 6 — Positioning | People decide whether they trust, fear, need, or leave. Day 7 preparation becomes visible. |
| 7 — Payoff | Endings reflect money, debt, Heat, crew, territory, relationships, and stored decisions. |

A successful ending may still contain separation, damage, or unfinished work. A
failed ending should make the choices that produced it legible.

---

## 4. Selection model

`scheduleStory` runs once at the end of each `advanceRun`. It never fires while
an event, encounter, or operation result is pending.

**Candidate filter:** not already resolved (for `once` beats) · `requires(state)`
true · `exit(state)` false · district matches (or `area: null`) · past
`earliest` · within `latest` · not in `run.recentEvents` · cooldown satisfied
against `run.eventHistory`.

**Three tiers, checked in order:**

| Tier | Rate | Purpose |
|---|---|---|
| `reactive` | fires unconditionally | Causally triggered callbacks. A post-payoff offer that only appears 55% of the time reads as a bug. |
| `chain` | `CHAIN_BASE_CHANCE` 0.30, +0.16 if no chain beat for 3+ slots | Story beats. |
| `ambient` | `AMBIENT_BASE_CHANCE` 0.20, +0.16 if nothing at all for 5+ slots, + heat and district risk | Street life. |

**Locality preference.** Inside the chain tier, a beat with an `area` outranks
one without, when the player is standing in that area. Mara's arc is
district-gated while Eli, Dre, and Rook are not, so without this rule the
anywhere-chains are eligible in every district and starve her: measured at 9%
reaching stage 4. With it, 48%. It also makes standing somewhere worth
something, which is the whole point of a dense Spenard.

**Anti-monopoly.** After two consecutive beats from one chain, that chain is
dropped from the pool whenever any other candidate exists. A chain with no
competition is never hard-blocked. **Reactive beats do not count toward the
streak** — Dre answering a payment the player just made is the game responding,
not his storyline hogging the week.

**Per-day cap.** `STORY_BEATS_PER_DAY = 2`. Without it the chain tier consumes
the registry by Day 4 and every run resolves every storyline — which is how v0.6
felt.

None of this metadata is rendered. Events show title, who, where, stakes,
description, and choice previews only; `tests/ui-contract.test.js` asserts no
leak into `ui.jsx`.

---

## 5. Chains

| Chain | Person | Beats | Stages |
|---|---|---|---|
| `mara_spenard` | Mara Velez | 6 | 1–6 |
| `eli_routes` | Eli Ward | 5 | 1–4 (stage 2 branches) |
| `dre_note` | Dre Holloway | 6 | 1–5 (stage 3 branches) |
| `rook_pressure` | Rook Mercer | 6 | 1–6 |
| `kip_corner` | Kip Sallis | 3 | 1–2 (stage 2 branches) |

**Branch stages.** Two beats may share a stage when they are alternative paths
through the same point — Eli's rejection reopening against his test-route
callback, or Kip's retaliation against the person who vouched for you. Stages
must still cover 1..N with no gaps, because a gap strands every later beat.

### Service Roads — Eli

Introduction, then a branch (the rejection reopening, or the route he changed
after spotting a tail), then the hand-drawn service-road map he has never shown
anyone, then the question about whether there is a seat for him after the
seventh night. He responds to being trusted with judgment; docking his pay for a
correct call buys punctuality and costs everything else.

### Dre's Note — Dre

The terms stated in dialogue rather than a number on a screen, a **reactive**
beat that fires on the first payment (and carries one of the six Street Name
usages), the due day branching across paid-in-full, meaningful partial, token,
and nothing, the post-payoff offer, and a Day 7 reckoning. He never threatens.
He uses silence, revised terms, and access.

### Rook's Attention — Rook

Six beats escalating from attention to confrontation: someone repeating a
private detail back to you, the tail on the service road, Rook arriving in
person to name a weekly number priced to be paid rather than argued about,
interference, the loading-bay collision, and a final position that reflects
respect against pressure. Direct violence only arrives after lesser pressure
fails.

### The Wash & Go — Kip

Introduction, then a branch between his retaliation and Deshawn — who vouched
for you before you robbed him — wanting a word. Kip is the object that makes the
Hustle and Stickup tracks legible against the same person: buy off him, ask him
what is moving, or take his corner. Robbing him chokes Spenard supply for two
days, and twice puts him off the block permanently.

### The Night Owl — Mara's arc

**What she wants, independent of the player.** Mara works nights at the Night Owl
to get onto a dispatch crew at a Ship Creek freight yard. The yard hires on
reputation and the owner knows every face in Spenard. *Public association with the
operation is the specific thing that costs her the job.* She is not a reward and
not a resource, and she can leave.

| Stage | Id | Class | Window | Beat |
|---|---|---|---|---|
| 1 | `mara_intro` | character_intro | Day 1+, Spenard | Coffee already poured. The sedan passes twice. Sets tone: flirt / friendly / distant. |
| 2 | `mara_shift_change` | character_followup | Day 2–6, Spenard | She names the dispatch job and what association costs her, and asks what people call you. **Street Name appears here.** |
| 3 | `mara_invitation` | relationship_scene | Day 3–6, trust ≥2 | Four hours and no car. Point Woronzof, the garage, or a raincheck. The garage sets `jobAtRisk`. Re-offers once. |
| 4 | `mara_boundary` | main_chapter | Day 4+, trust ≥1 | A plate written on her wrist. Truth, an alibi at her expense, or silence. |
| 5 | `mara_sedan_night` | threat (encounter) | Day 5+ | The sedan waits out her shift. Text reflects stages 1, 3, and 4. |
| 6 | `mara_after` | callback | Day 6+ | Three branches: she leaves, she hands over a Ship Creek contact, or a level goodbye. **Street Name appears here.** |

**Day 7 outcomes**

- `mara_escape` — "Two Tickets South". Trust ≥3, not betrayed, escape plan.
- `mara_clear` — "She Gets the Monday Interview". Trust ≥3, not betrayed, job not
  at risk, stage 6 reached. **A separation, not a failure.**
- `mara_gone` — "Gone Before You Were". She left.

**Trust gate (stage 4).** She only asks the hard question if something is there.
This is why the arc does not complete in every run: players who stay distant stop
at stage 2, and that reads as a path the week did not take.

---

## 6. One-off street events

All repeatable, 8-slot cooldown, ambient tier.

| Id | Class | Where | Situation |
|---|---|---|---|
| `wet_bricks` | opportunity | Loading Bay Seven, Industrial | A torn tarp, freezing rain, and seals that mostly look intact. |
| `door_knock` | threat | Fourplex near North Star | APD working along the row toward this door. |
| `stranded_wagon` | ambient | Minnesota Drive off-ramp | Dead battery, two kids, forty cars already past. |
| `found_phone` | opportunity | Fourth Avenue transit shelter | Unlocked, warm, six days of somebody's pickup schedule. |
| `careful_customer` | threat | Current market | A buyer whose hands are wrong for his story. |
| `dock_shift` | opportunity | Ship Creek freight dock | Four hours of honest unload, cash at the door. |
| `garage_furnace` | ambient | North Star back bay | The door seal froze to the frame overnight. |
| `sedan_rumor` | ambient | Anywhere | A third-hand story where everyone agrees on the color and nothing else. |
| `midtown_lights` | threat | Seward Highway at 36th | A collision, not a checkpoint — and every officer in Midtown watching traffic crawl. |

**Constraints met:** 5 of 9 involve no criminal transaction (`stranded_wagon`,
`dock_shift`, `garage_furnace`, `sedan_rumor`, `midtown_lights`) · 5 set callback
flags · `found_phone` and `stranded_wagon` pay reputation instead of money ·
`sedan_rumor` deliberately has no correct answer.

`dock_shift` sits at Ship Creek to rhyme with Mara's dispatch thread without
requiring her chain.

---

## 7. Copy audit — inherited v0.6 events

Scored against §1. **All 14 failed**, so all 14 were rewritten. Effects, flags,
choice counts, and `requires` gates are unchanged; only prose moved.

| Event | Description before | After | Failure |
|---|---|---|---|
| `mara_intro` | 38 w | 64 w | short; thin results (17–22 w) |
| `eli_offer` | 39 w | 65 w | short; thin results |
| `eli_callback` | 30 w | 64 w | short; results 14 w |
| `dre_warning` | 25 w | 62 w | short; results 12–14 w |
| `dre_after_payoff` | 24 w | 66 w | short; results 11–16 w |
| `rook_cut` | 20 w | 58 w | short; results 13–15 w |
| `miri_offer` | 26 w | 65 w | short; results 10–11 w |
| `tone_offer` | 26 w | 62 w | short; results 11–13 w |
| `courier` | 30 w | 59 w | short; thin results |
| `base_watch` | 22 w | 59 w | short; results 11–13 w |
| `crew_crisis` | 22 w | 59 w | short; results 14 w |
| `buyer_hurry` | 25 w | 58 w | short; results 13–14 w |
| `checkpoint` | 21 w | 60 w | short; results 12–15 w |
| `rough_night` | 20 w | 53 w | short; results 15–20 w |

Three choice labels also exceeded 7 words and were shortened.

---

## 8. Measured pacing

`node tests/simulate-runs.js 200` — 600 runs, 0 dead ends.

| Profile | Story beats | Ambient beats (distinct) | Total | Mara ≥4 | Mara ≥6 | Quiet runs |
|---|---|---|---|---|---|---|
| cautious | 7.1 | 5.2 (4.0) | 12.3 | 42% | 8% | 9/200 |
| balanced | 6.8 | 6.6 (5.2) | 13.4 | 22% | 1% | 7/200 |
| aggressive | 4.3 | 3.7 (3.4) | 8.0 | 0% | 0% | 161/200 |

Opening variety: **26 of 30 distinct** first-three-beat sequences across seeds.
The v0.6 ladder produced exactly one.

**Reading these numbers honestly:**

- The three profiles are deliberately simple bots, not humans.
- The **aggressive profile never returns to Spenard** (its route is
  Industrial → Downtown), so Mara is structurally unreachable at 0%. That is the
  design working: you do not meet the Night Owl clerk if you never go there.
- Its high quiet count is mostly an artifact of the bot spamming Rob.
  `ROB`, `ELI_TEST_ROUTE`, and `TAKEOVER` pass `suppressStory: true`
  (game-core.js) so they do not stack two modals on one tick — slots spent on
  them never roll a beat. A human uses Rob rarely; it is gated to
  working capital below $150.
- A Spenard-resident probe measures Mara ≥4 at 64% and ≥6 at 37%. The truth is
  between the two, and **human playtest is required** to settle it.

---

## 9. House rules

- Hidden thresholds, trust values, probabilities, and chain metadata never
  appear in the interface.
- Event choices do **not** advance time. The beat is delivered at the end of an
  `advanceRun` that already ticked; resolving it must never add a second tick.
  Previews must not claim a time cost.
- All randomness runs through the seeded RNG. No `Math.random`.
- New state is additive so v3 saves keep hydrating through `mergeDefaults`.
