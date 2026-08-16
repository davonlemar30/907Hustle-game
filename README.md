# 907Hustle: One Good Run

907Hustle is a mobile-first, single-player crime, trading, relationship, and light-RPG web game set in an Anchorage-inspired Spenard. A run follows a newcomer balancing clean work, street income, debt, family housing, friendships, rivals, crew, and territory across a dynamic Week Zero.

## Current Build (v1.19)

**v1.19: Observation-Gated Recruitment — Pherris + Deshawn Retro-Gate** — the
pattern v1.18 built for Tone, applied until no flat gate is left. Pherris is
earned through the market rather than through nerve: her lens counts money
moving quietly, and 907List profit now travels on the network channel, so the
people who trade in money for a living can finally hear about the money. Once
she is on the payroll she is worth one effective level of Intelligence on market
reads. Deshawn's tiers stop being a flat pass and read his own ledger, which
makes **every crew advancement in the game an Exposure read**.

| | |
|---|---|
| Save schema | **v11** (`907ogr_v11`), loads v3 and up |
| Tests | **676** passing (`npm test`) |
| Simulation, 200 runs | `114d08f7aaf1ab529e36af7716da69e311cbe23db13af96a91b79c290799b9db` |
| Simulation, 2,000 runs | `1bd2c29905bcb3dd55adff32c6787b4f659e5629fa5d1f225f7cbf40272acc36` |

Both hashes moved on purpose: a new lens adds telemetry keys, and the market
strategies now spend cash on Pherris and pay her wage. The de-escalation
refactor that shipped alongside is **hash-neutral across both run counts**.

**The systems underneath:**

- **Exposure System** — ten NPCs, each with a ledger of what they saw and a
  personality lens that decides what it meant. Dispositions are derived, never
  stored, and one of them is now a recruitment gate: Tone reads the same ledger
  everyone else does and signs on for what it says.
- **Attribute Triangle** — Combat, Charisma, Intelligence. They buy *advantage*
  (a second roll, then immunity to catastrophe), never a hidden percentage.
- **Criminal Economy** — Stick, Boost, the plug market, and Slide's fence, all
  priced by district difficulty, heat multipliers, plug suspicion, and bleed.
- **Crew + Curtis Awareness** — 0-10 loyalty with nightly wage settlement, and a
  separate 0-15 tracker for how hard Curtis's people are looking for you.
- **Territory Blocks** — six Spenard blocks held by individual soldiers under
  Eli, layered over the older district-wide takeover system.
- **907List Broker** — a tiered resale track where the listing title is the
  appraisal skill and the flip is a judgment call.
- **Arrest & Jail** — bail and clock traded for heat relief and a permanent
  record, with priors making the next one dearer and longer.
- **The Nile** — two floors, two siblings, and the one place in Spenard that
  Curtis's network cannot hear.

Full structural reference: **[ARCHITECTURE.md](ARCHITECTURE.md)** (file map,
state shape, event-card schema, and the rules a change has to hold to).
Build-by-build history: **[PROJECT_STATUS.md](PROJECT_STATUS.md)**.

## What changed in v1.17

**The game stops reading like a system log and starts sounding like Spenard.**
Every player-facing line that reported a mechanic — the market receipt, the
crew wage warning, the bail popup — now communicates the same information
through physicality, place, and character. Save schema **stays at 11**
(`907ogr_v11`): the only new field is `nightOwl.recentMinaLines`, additive, so
`mergeDefaults` hands it to v3–v11 saves with no migration pass. **Both
simulation hashes are unchanged on purpose** — the reducer was not touched;
see Verification.

- **The Leave Market button is gone.** It read as a mandatory step and was
  really a time-cost gate. Leaving the Market is now the close: the shell fires
  the same `END_MARKET` dispatch on the way out, and only when the visit
  recorded a buy or sell (`run.currentVisit.trades > 0`, the counter that
  already existed). Window shopping costs nothing. The reducer still advances
  time on a bare `END_MARKET` — the simulation harness and a decade of tests
  use it as "stay put and advance," so the gate lives in the shell where the
  button lived.
- **Consequence cards got their severity stripes back.** `v05.css` had
  referenced `--text`, `--good`, `--warn`, and `--bad` since v1.11 without ever
  defining them, so every card rendered without its tone accent. A v1.17
  `:root` layer defines the four as aliases of the base palette.
- **Voice pass on the system feed.** Arrest banks gain the plastic-bench
  booking line and the 6 AM release; crew events speak in behavior (the number
  that stops ringing, the silence about money) instead of stat receipts; the
  market feed reads as the player's own count. Event-card previews keep numeric
  tags only for HUD-visible cash, Health, and Heat — hidden relationship state
  (Mina, Dre, Curtis) previews in-world. No em dashes in player-facing prose.
- **Mina Vale has a conversation tree.** `src/data/mina.js` carries dialogue
  pools per disposition band (Neutral through Bonded; Cold and Hostile clamp up
  to her formal transactional register), split by shift — the Evening on-shift
  voice and the Night comfort-zone voice, since the Night Owl keeps
  Evening/Night hours — plus state-reactive pools for a player who arrives
  recently arrested, hurt, or flush. Lines rotate with a three-visit no-repeat
  window (`nightOwl.recentMinaLines`, the watcher-pool pattern). Her trust,
  exposure, and story cards are untouched.
- **The criminal economy speaks Anchorage.** Boost targets are the Spenard
  Chevron, Rebel Convenience on 4th, Holiday on C Street, Denali Express,
  Northern Lights Pharmacy, Arctic Cash & Carry, and Ship Creek Yards, each
  with a one-line read of the place; stick targets get the same identity (the
  stumbler outside Koots, the Wash & Go regular); plug introductions name their
  corners (the bus shelter at Spenard and Northern Lights, the parking garage
  at 4th and Gambell). Ids, tiers, takes, and windows are untouched.

**Balance: none.** No probabilities, outcome pools, growth rates, or NPC lens
weights moved. The only behavior change is where the Market's time cost fires,
and that path was always UI-dispatched.

**Out of scope, on purpose:** the new plugs (Nell, Yuri), Mina's romance-arc
mechanics (only her dialogue voice ships here), territory changes, and the
numeric labels on the crew roster and Status screens — those stay
numeric-on-demand per the mechanical-labels design-debt task.

## What changed in v1.16

**Getting caught became a system.** Heat was a death timer with nothing in the
middle: it clamped 0–15, and at 15 the run ended, but between those two numbers
being caught barely existed. Three stubs left behind by earlier builds — the
Stick arrest TODO, the never-read `flags.boostArrestRisk`, and a crew member who
could be set to `status: "arrested"` and never come back — are all wired into one
funnel now. Save schema **stays at 11** (`907ogr_v11`): every field this build
adds is additive, so `mergeDefaults` hands it to v3–v11 saves with no migration
pass. Both simulation hashes moved on purpose — two failure paths were rewritten.

- **Arrest resolves heat and replaces it with a record.** `arrestPlayer` is the
  single funnel: it charges bail (dirty cash first), advances the clock by a
  processing cost, drops heat by a severity-scaled relief, writes the charge to
  `state.record`, and broadcasts `heat_exposure` on the network channel — which
  through v1.15's `broadcastTracked` is exactly what raises Curtis's awareness.
  Being arrested is what his people notice.
- **The release valve costs what it clears.** Heat relief runs −2 for a tier 1
  boost up to −5 for an organized stick, so cheap offenses cannot farm big heat
  dumps: a stickup player at heat 12 caught on a tier 1 job still comes out at 9,
  inside the warning zone. Every prior raises bail (up to 3.5×) and lengthens
  processing, so a second dump costs more than the first.
- **A player who cannot pay serves time instead.** Bail is charged up to whatever
  cash exists and the shortfall converts to parts of day at $150 a slot, capped
  at one day. There is no bail a broke player can be soft-locked against.
- **All three Stick tiers route through it.** The v1.13 stub covered tier 3 at
  heat > 8 and took a flat $200. Tier 1, 2, and 3 each now book at their own
  severity, gated on a catastrophic outcome or on heat above 10 / 8 / 6 — the
  bigger the job, the less heat it takes for somebody to already be looking.
- **Crew go to jail, and you decide whether to show up.** A crew member caught on
  a ring job gets `status: "arrested"` and a `jailedUntilDay` scaled by severity
  (1 day for a boost, up to 5 for a tier 3 stick). Bail them out and they return
  at −1 loyalty. Leave them and they walk out on their own date at loyalty **1** —
  one missed wage from leaving for good. This also repairs a live v1.15 bug:
  `recruitedCrew()` filters on `status === "active"`, so an arrested member
  silently stopped counting toward capacity and power with no way back. A record
  with no release date is now released the first time the day rolls.
- **A blown boost is a scene, not a log line.** Tier 1 and 2 failures used to
  auto-resolve into a ban and a heat bump; tier 3 just zeroed the merchandise.
  All three now open a three-choice encounter through the consequence engine
  (`encounters.js`), reusing `EncounterModal` — no new UI shell:
  - **Fight** — opponent difficulty scales by tier (clerk / security / armed
    guard). Win and you keep the take, +1 heat, 4–12 health for the scuffle. Lose
    and it is a ban, 12–28 health, and an arrest. Combat 3 buys the advantage
    double-roll and Combat 6 removes the catastrophic tier outright, which is what
    the hours at the Spenard Gym were for.
  - **Run** — a secondary escape check, Combat-shaped, helped by running shoes and
    hurt by a full bag. Clear it and the take comes with you. Miss and it is a
    ban, more heat, and bruises — plus a booking if `boostArrestRisk` was armed.
  - **Give it up** — no roll, no heat, no damage, no charge. They keep the goods
    and the store keeps your face. The option that exists for when heat is already
    the problem.
  Fight broadcasts a `violence` row win or lose, so fighting your way out of every
  shoplifting bust builds a reputation the civilian NPCs weight against you.
- **The first-boost opportunity card goes through the same door.** That event
  resolves a lift inside an event effect rather than through the `BOOST` reducer;
  it now opens the caught-state too, so a failed lift can never cost nothing.
- **UI:** a **Record** card on Character (priors, last booking, the current bail
  multiplier), and an arrested crew member's page swaps the Pay-arrears button for
  **Bail out · $N** with their release date in the status line.

**Balance.** Across 2,000 seeded runs the economy moves **−1.11%** overall, with
the three profiles the arrest paths touch taking it: `stickup` **−4.5%**,
`aggressive` **−4.1%**, `thief` **−1.8%**. The clean-money profiles are inside
±1% apart from RNG-stream reshuffle. 70 arrests occur across the 2,000 runs, all
of them in the criminal profiles. Zero dead ends.

**Out of scope, on purpose:** multi-day sentences for the player (needs a skip-N-
days UX that does not exist), lawyers as a service, police as a named faction, and
any arrest-to-job-loss interaction beyond what `applyHeatEmployment` already does.

## What changed in v1.15

**A systems build.** Save schema bumps to **11** (`907ogr_v11`); v3–v10 saves
all load. Both simulation hashes moved on purpose — a new NPC, new nightly
resolution, and new event outcomes. Three systems, built on the crew
infrastructure that already existed rather than beside it:

- **Crew loyalty is a 0–10 scale now.** Everyone starts at 5; the old
  ±delta accumulator rescales on load (`clamp(5 + old, 0, 10)`). Tier
  promotion is uniform and player-initiated: Tier 2 wants loyalty 7 and five
  days on the crew, Tier 3 wants loyalty 9 and twelve, plus each member's own
  conditions (Deshawn's truces, Pherris's blocks and buy-in). The constants
  live in the new `src/data/crew.js`, along with the tier wage curve and the
  commented-out soldier schema the territory build will wake up.
- **Wages pay themselves — or don't.** At day end each active member's wage
  auto-deducts, dirty cash first, highest loyalty paid first. A short night
  accrues arrears; after two nights of grace, loyalty bleeds one point per
  unpaid day, and at zero the member departs — assignments cleared, capacity
  freed, ledger left behind. "Pay crew" now clears arrears rather than being
  the whole system. `crewMeta.totalWagesPaid` tracks the lifetime spend.
- **Curtis's people are looking before Curtis is a scene.**
  `state.curtisAwareness` (0–15) rises when criminal observations genuinely
  reach him on the network channel (+1), when Spenard sees three market
  transactions in a day (+1), and when a robbery lands (+2). The Nile raises
  nothing — that is the point of the building. Quiet days bleed it back down,
  but never below a reached phase floor: ambient at 3, watching at 7,
  approaching at 11. From ambient on, unnamed watchers surface as
  non-blocking flavor during Spenard movement (one a day at most, seeded off
  `stringHash`, no line repeated within three), and each phase reached pushes
  one Word Around Town text.
- **Deshawn is the first scene-recruited crew member.** He joins the Exposure
  roster (STREET lens; betrayal −5, loyalty +4; neighborhood and household
  channels, never network) and offers himself at the Night Owl from Day 5
  when the player either keeps two contacts active / two Spenard ledgers
  Warm, or — having robbed Goodie — paid the $120 restitution and run one
  clean Dre mission. "It was business" still closes the route forever.
  Declining is a three-day rain check, not a refusal.
- **What $50/day buys:** *Let Deshawn handle it* on confrontations in both
  encounter engines and the stick retaliation card — no health loss, one
  point of heat worked off, a discretion row for the block — though never
  against Curtis's own crews, and choosing violence over his judgment (or
  within two days of it) costs a loyalty point, once per lesson. A **weekly
  introduction**: The Nile's ground floor, then the Spenard Gym, then a Night
  Owl regular, then a reliable market tip when the map is used up — two
  texts each, his voice calm and short. And the **Yalonda rent grace**
  re-arms once per rent period while he is on the crew instead of being a
  one-shot recruitment bonus.
- **UI:** More gains a **Crew** row that opens the People crew pages
  directly; crew cards read loyalty as n/10, show the tier wage with the
  auto-pay note, and grey out departed members.

## What changed in v1.14

**A presentation build.** `game-core.js` is untouched: the reducer, the save
schema (**10**), and both seeded simulation hashes are byte-identical to
v1.13's. Four changes — a component library the rest of the UI can now be built
out of, a Travel menu that fits on one thumb, a Tonk table that behaves like a
card game, and a Market button that admits what it costs.

- **Three primitives extracted into the design system.** `AccordionSection`,
  `ActionCard`, and `BadgeHeader` join the eleven components already in
  `src/ds/primitives.jsx`, with prop contracts in `src/ds/index.d.ts`. The
  Phone's five sections and Home's active-job card were the private
  implementations these were pulled out of, and both now render through the
  shared version — same markup, same 44px headers, same `0fr → 1fr` panel
  animation, same `prefers-reduced-motion` opt-out, zero visual change.
  `BadgeHeader` hides itself at a count of zero, because an empty pill is noise.
- **Travel is three destinations, not six.** **Spenard** (the district you are
  standing in — jobs, wandering, contacts, and every door you have found),
  **Home** (storage, Yalonda, Juan, sleep), and **Leave Spenard** (known
  destinations and People Mover passes, with the $5 fare stated on the row and
  the reason printed on any ride you cannot afford). Everything the old menu
  carried is still reachable one level down inside whichever of those three
  owns it.
- **Local Intel is content now, not a menu row.** Walks and discoveries collapse
  into a "What you've learned" accordion on the neighbourhood hub, gated on the
  same district action the row was. The routes half of that page was already on
  Leave Spenard and Transit, which is where a route is something you can act on
  rather than something you read.
- **The Listings page is gone.** Two of its three cards were deferred
  placeholders and the live one — the North Star Garage lease — is already
  offered by 907List. Nothing routed to it after Travel dropped to three
  destinations, so it went with them rather than staying as unreachable code.
- **Tonk plays fullscreen.** Sitting down hides the HUD band and the bottom
  dock and gives the table the viewport; a fixed 44px overlay carries **Quit**
  (a real drop, so it confirms first) and **Back** (presentation only — the hand
  stays standing, and a "Back to the table" bar brings you straight back). When
  an opponent plays, the card they pitched slides in from the right, holds for
  1.5s with the seat and the read on it, and fades — derived from the discard
  the reducer already publishes, so nothing about the hand changed.
- **A hand that ends always gets its receipt.** Losing one moves no money — the
  buy-in left the wallet when you sat down — so v1.9c's quiet-receipt rule was
  swallowing the single moment the fullscreen table hands the shell back. The
  reducer's own closing line is the win / loss / Tonk-out copy.
- **"Finish Trading" now reads "Leave Market · advance to {slot}".**
  `END_MARKET` is a `TIME_ACTIONS` member, so the button always spent a part of
  the day; the old label named a bookkeeping step instead of the price. Same
  dispatch, same reducer, same hash.

## What changed in v1.13

**A gameplay build: geography starts charging for crime.** The criminal economy
grows from one full track (Boost, shipped quietly across earlier builds) and
two loose robbery levers into three parallel tracks with district-aware math,
and the city starts talking back. Save schema moves to **v10**; both
simulation hashes move on purpose (details in Verification).

- **District modifiers** (`src/data/districts.js`). Every criminal track reads
  two numbers per district — a difficulty nudge (one step = 0.08 of success
  chance, or 4% of buy price on the market) and a heat multiplier. Spenard
  runs a quiet, easy market but loud, hard stickups; Downtown is the reverse;
  the Service Roads pay robbers and punish shoplifters. Fairview and Mountain
  View are scaffolded in data for the districts that don't exist yet.
- **The Stick track.** Robbery is now a ladder like Boost: street work at
  Tier 1 (drunks outside Chilkoot's, the Wash & Go lot, bar crawlers on
  Fourth), named registers behind a weapon at Tier 2, and organized jobs —
  Goodie's stash, the dice game behind the rec center — behind rep 10, a
  weapon, and planning at Tier 3. Casing a big target twice prices the take
  and sharpens the job; two robberies a day is the ceiling before people
  start naming you; a job's victims can queue a retaliation card that finds
  you two mornings later. The service-road envelope and Rob-Goodie both feed
  the same rep ladder. A botched Tier 3 job at real Heat books you: bail and
  the rest of the day (the full arrest system remains a future build).
- **Plug suspicion.** Robbing anyone on a plug's home block makes that plug
  wary: suspicion 3 prices a 10% risk premium into every unit, 5 cuts you off
  entirely. Robbing a plug directly burns three standing with every plug at
  once. A clean purchase or a quiet day on their block works suspicion back
  down one point.
- **Cross-district awareness.** Every criminal action raises that track's
  awareness where it happened, and half a point bleeds to each adjacent
  district a day later. Every three points is another difficulty step. Work
  one district hard and it hardens under you.
- **The seeded first lift** (bug 86bbejvu9). The Boost unlock now draws from
  three framings across the current district's tier-1 stores instead of always
  being the Night Owl camera — six variants, seeded per run, verified across
  50 seeds with no variant dominating.
- **Slide Okafor** is the fence's name now — a storage unit off Tudor Road,
  strictly transactional. Same rates, same standing ladder.
- **Curtis stays off fresh Hustle screens** (bug 86bbejvtn). The rival card
  renders only once he actually knows the operation exists (or his attention
  forces a decision), reframed as "Rival pressure" below the income rows.
- **Trade modal hardening** (bug 86bbe3k2b). The buy ceiling now includes the
  plug's per-visit cap (previously an over-cap buy was a silent dead button),
  floors at zero, and coerces cleared/NaN input. The reducer's own zero-unit
  guard was already in place from v1.10.
- **Quick Score** (ticket 86bbaqb8f) turned out not to exist anywhere in the
  code — the service-road envelope is that design's successor and stays.

## What changed in v1.9c

**The UX pass deferred from the 1.9 series, shipping after v1.12a.** Three
playtest complaints, one build: time-slot popups interrupted flow, the Phone was
an information dump, and the daily shift took four taps. `game-core.js` is
untouched — the reducer, save schema (**9**), and both seeded simulation hashes
are byte-identical to v1.12a's.

- **Quiet time receipts.** The action receipt only appears when it has delta
  lines to show (cash, Heat, Health, an attribute). An action that only moved
  the clock — a walk, a full-health sleep, an empty travel leg — updates the
  HUD time pill and the feed silently instead of popping "MORNING → AFTERNOON"
  over the screen. Receipts that do appear keep their amber time band, and the
  day-end confirmation gate is untouched.
- **The Phone is an accordion hub.** Five collapsible sections — Texts,
  Contacts, Bills, Today's Log, Word Around Town — each a 44px header with a
  count, opening with only Texts expanded. The fold state is React-only session
  state, animated `grid-template-rows: 0fr → 1fr` over 200ms with a
  `prefers-reduced-motion` opt-out. At 375×667 nothing renders below the fold
  until the player asks for it.
- **Contacts ride the phone.** The Contacts section renders the same
  `SocialContacts` component as the standalone screens — same Call/Text/Visit
  tier gating, same `CONTACT_*` dispatches, zero duplicated logic. Phone
  service off disables Call and Text with the existing reason copy; Visit still
  works.
- **A unified Bills panel.** Phone service ($75), rent ($150), crew wages, and
  Dre's debt in one display-only list: amount, due day, and a status that walks
  paid → upcoming → due-soon (amber) → past-due (red). The collapsed header
  badges the count of obligations needing attention within two days. Each row
  names its canonical pay surface instead of duplicating pay buttons. (The
  build doc listed memberships as a data source, but the gym membership is a
  one-time $30 join fee and bus passes carry no expiry day, so neither is a
  recurring bill in the code. Phone and rent exist from Day 1, so the "No
  bills yet." empty state is defensive only.)
- **The active job lives on Home.** An "Active Job" card between Needs
  Attention and Wander: employer, schedule, rank, and a full-width red WORK
  SHIFT button that dispatches the exact `WORK_JOB` action the Street job page
  uses (standard approach). Availability comes from the same `jobAvailability`
  selector — wrong slot, already worked, heat — plus spelled-out reasons for
  the two silent reducer gates (no energy, day-end armed). With no active job
  the card is a prompt ("No job yet. Explore Street to find work."), not a dead
  button. The v1.12a Wander wiring was verified in place and unchanged.
- **Travel row de-duplicated.** Street's first row was titled "Around Spenard"
  but opened the Travel screen, whose own "Around Spenard" row opened the
  actual Around Spenard screen. The Street row is now titled "Travel" with the
  current district as its status, so every row title matches the screen it
  opens and no screen repeats its parent's label.

## What changed in v1.12a

**A presentation build, not a gameplay one.** Home read like a dark-mode webapp:
bordered boxes and menu rows carrying every value the player needed and none of
the atmosphere the game is about. v1.12a rebuilds that one screen — the reducer,
the save schema, and the seeded simulation are untouched, and the 200-run
simulation output is byte-identical to v1.11's.

- **A HUD bar instead of a HUD grid.** Day in Anton, the part of day in mono
  amber beside its slot pips, the district muted on the right, cash in glowing
  green. Status and Menu stay on the band as compact 44px controls.
- **Segmented pressure chips.** Heat and Respect draw as five glowing segments
  instead of a number, because how close a bounded scale is to its ceiling reads
  faster than the integer. The exact reading stays the chip's accessible name,
  and the progressive rule is unchanged: the row still appears only once
  something on it is applying pressure.
- **An atmospheric hero.** A photograph of Spenard Road under the situation
  summary's first two clauses — white lead, red consequence — with the derived
  street identity on a gold badge. The message is `homeSituation().summary`; no
  new state, no new copy.
- **Needs Attention, now three rows.** `homePriorities()` raises its cap from two
  to three (the only change in `game-core.js`), and each row carries a glyph, its
  deadline stamp, and the same routing to the screen that can resolve it.
- **One dominant action.** `WANDER SPENARD` is the largest element on the screen:
  red gradient, SVG-turbulence surface, a three-second glow pulse behind
  `prefers-reduced-motion`. Outside Spenard it holds its place and renders
  disabled with the reason rather than vanishing.
- **Yalonda's apartment as a place.** The building photograph beside presence,
  stashed cash, and stored product, over Talk / Stash / Sleep.
- **Home is the centre of the bottom bar.** It moves from the left edge to the
  middle slot, filled and glowing, with a held-open column for Hustle so it never
  slides sideways as the run unlocks things.
- **Grain, scanlines, and a red bloom** over the whole shell, at the opacities
  where they read as texture rather than as an effect.

Photographs ship as WebP with PNG fallbacks through `<picture>` (43 KB of WebP
for both). The grain is an inline SVG `feTurbulence` tile, not a raster texture.

## What changed in v1.11

**Charisma and Intelligence stopped being dead ends.** v1.10 made attributes the
engine behind every outcome and shipped with a hole it named itself: only Combat
had a way up. Two thirds of the system gated real checks — job interviews,
negotiation, market reads — with no path to improve them. v1.11 closes the
triangle by opening **The Nile**, a two-floor Ethiopian-owned building on Spenard
Road, and by making three things that were already happening finally count.

- **Six new growth sources.** Charisma from a wellness visit (0.25), a hand of
  Tonk (0.4), and a night at the Night Owl (0.15). Intelligence from a round of
  Cee-lo (0.4), a 907List flip that clears a 1.3x margin (0.2), and watching
  Biniam work the coffee ceremony (0.15). All six taper on the same log2 curve
  the gym uses, and none of them can carry a player past *Solid* alone.
- **The Nile, two floors.** Downstairs is Blue Nile Wellness: $30 and a part of
  the day buys back 15 health, which makes **Selam Tesfaye** the cheapest recovery
  in the run and the reason you find the building before you find the room above
  it. Upstairs is **Biniam Tesfaye**'s room, open Evening and Night behind a
  code-locked door that only a vouch opens.
- **Two games that are actually games.** Tonk deals five cards from a real
  52-card deck; you form spreads and runs, drive your hand toward zero, and drop
  when you think it is the lowest at the table — drop wrong and you pay double.
  Cee-lo is three dice, a banker's point, 4-5-6 and trips and 1-2-3, and real
  odds. Neither is a stat check with animation.
- **The attribute buys information, never outcomes.** At Charisma 3–5 one
  opponent visibly hesitates; at 6+ you read their hand's category. At
  Intelligence 3–5 you get a phrase for the odds; at 6+ you get the exact number
  *and* the option to press or back off. Crucially the *read itself* is a roll:
  in the middle band it can be wrong, and a catastrophic read shows the tell
  backwards. Reaching 6 removes the catastrophic tier entirely, so what the high
  band actually buys is **certainty**, not a bigger edge.
- **The Nile is quiet, and that is the point.** Nothing that happens in that
  building reaches Curtis's network channel. Observations propagate on
  neighborhood and household only. A player under rival pressure can build social
  capital here without feeding the attention system, which makes The Nile
  strategically valuable rather than merely new.
- **The abstract backroom game retired.** `spenard_gambling` was a stat check
  with a stake. Cal's discovery scene at the Night Owl survives as a real
  narrative beat and now points at The Nile's second floor. Nobody rolls fake
  dice ten feet from real Cee-lo.

**Two bugs the playtest caught that the tests could not.** Selam was speaking her
Warm line whenever her *brother* liked the player, because one shared `band` was
serving two people. And the dice were badly biased: deriving three throws from
keys differing only in their last character reads correlated bits out of FNV-1a,
which produced 1-2-3 at 14% against a true 2.8% and a real point at 0.8% against
a true 41.7%. Every rules test still passed, because they all used hand-built
dice. Both are fixed and both now have tests — including a 60,000-throw
distribution assertion.

**Saves are v9.** v3 through v8 all migrate. New fields default in through
`mergeDefaults`, so a v8 save arrives with The Nile undiscovered and the tables
at zero.

**Balance, measured over 2,000 seeded runs.** Every strategy except the gambler
sits within 4.6% of its v1.10 average, and the eleven non-gambling strategies
move **+0.19%** overall — the new content is additive rather than disruptive. The
gambler is **+34%**, which is the system working: real decisions at a real table
beat the EV-negative single roll it replaced.

| Track | Sessions/day | Reaches 3 |
|---|---|---|
| Charisma (spa + Tonk) | 2 | **Day 6** |
| Intelligence (Cee-lo + coffee) | 2 | **Day 7** |
| Either, one session/day | 1 | Day 11–14 |
| Any track, alone | 3 | **never reaches 6** |

## What changed in v1.10

**Attributes stopped being decorative.** Six numbers became three — **Combat**,
**Charisma**, **Intelligence** — and they are now the invisible engine behind
every outcome the game resolves. A player who trains robs cleaner, generates
fewer negative observations, and keeps the people around them better disposed
without ever seeing the math.

- **Advantage, not percentages.** `resolveWithAttribute` is the one entry point
  for an attribute-modified roll. Attribute 0–2 is a single roll; 3–5 rolls twice
  and takes the better; 6+ removes the catastrophic outcome from the pool
  entirely. The chance a roll starts from still comes from heat, gear, health,
  disposition, and district — the attribute shapes the *quality* of what happens,
  not the odds of a coin flip.
- **Quality decides who hears about it.** A clean robbery writes one financial row
  that goes nowhere; a messy one reaches the neighborhood; a catastrophe reaches
  the network with the heat attached. Being good at crime makes you quiet, not
  invisible.
- **The gym actually builds something.** Bag work, cardio, and sparring (Combat 3+,
  and it can send you home hurt) grow Combat on a `log2` curve. Sessions one
  through three matter, four through seven taper, and past that the gym alone
  cannot carry you. Three consecutive days is worth a level on the next check.
- **Street Identity is derived, not assigned.** Sixteen labels from a matrix of
  your strongest attribute against what you have actually been seen doing. Pure
  read, no nightly loop, no stored value, and it gates nothing.
- **Heat costs you work.** A warning at 8, a final warning at 10, fired at 12 —
  matching Yalonda's housing ladder. Day labor is exempt. The Night Owl stops
  scheduling you rather than firing you, so Mina survives a bad week.
- **Reputation is settled as a design decision.** There is no global reputation
  stat and there will not be one; see ARCHITECTURE.md.

Applying for a job is a real Charisma check now rather than a formality, and
Intelligence narrows the 907List sell swing from ±20% to ±15% at 3 and ±10% at 6.

**Balance moved on purpose, and it is reported rather than hidden.** Standing
gains brake as they climb, gambling pays a full pot only on a clean read, and a
gym session buys less than the old flat progress did. Across 2,000 seeded runs
the economy is down **15.5%** overall against v1.9b, concentrated where those
three changes land: `trainer` −49%, `mixed_freedom`/`operator` −29%, `thief` −26%,
`trader` −21%, against `stickup` **+24%** (a clean robbery draws a third of the
heat a messy one does, so violent runs survive longer). Story pacing is unmoved
at 9.5 beats a run against 9.7, and the 907List tier ladder holds its band:
tier 1 **$38.3/day** and tier 2 **$73.2/day** both in target, tier 3 still short
at **$30.5/day** for the reasons v1.9b documented.

437 tests pass and 2,000 seeded runs finish with zero dead ends.

| Run | SHA-256 |
|---|---|
| `--total 200` | `77b09d7bb1ea9be7440bccac517175679fce3008e83f02923e3cb0a3f4c573ac` |
| `--total 2000` | `8f68db014f0fe466f38edad05454f632fb90ca2eef0c9c8af4707bb30714990b` |

## What changed in v1.9b

**907List stopped being a money printer.** Buying and selling used to cost no
time, carry no risk, and resolve instantly, so there was never a reason not to
spam it. It is now a legal hustle with three earned tiers, real opportunity cost,
and a risk number the player moves by deciding when and where to meet.

- **Three tiers.** *Scrapper* (default) sees two listings a day, a title and a
  price and nothing else, and meets sellers in Spenard only. *Flipper* (the $250
  laptop) sees four with condition and seller reliability, unlocks Downtown
  meetups at a 30% better margin, and can quick-sell. *Broker* (ten clean flips
  with fewer than two disputes) gets named buyers who text what they need, bulk
  lots from distressed sellers, and verified status that sells the same day.
- **Appraisal is the verb.** Asking price and true value are separate fields, and
  the board carries listings worth less than the seller wants for them. A
  Scrapper gets no condition readout, so "Flatscreen, cracked bezel — $65" is the
  whole tell. Deliver one at a loss and it is a dispute, and two disputes close
  Broker standing for the run.
- **Time is the balancer.** A buy costs a part of the day. Posting is free; the
  delivery costs another part of the day, the next morning. A quick sell trades
  20% of the margin for the same slot and certainty. 907List now competes with
  gym, jobs, the Night Owl, and the drug loop for the same four slots.
- **Robbery is a decision, not a die roll.**
  `0.03 × (carried/100) × district × time of day × (1 + heat × 0.1)`. Two hundred
  dollars of stock Downtown at Night on heat 4 is **38%**; the same bag in
  Spenard on a Morning is **3%**. The number is shown on the page before you
  commit, because a risk the player cannot see is not a decision.
- **Every roll is replay-stable.** Snipes, flakes, price volatility, and robbery
  all hash the seed rather than drawing from `run.rngState`, so an unrelated
  encounter earlier in the day cannot change how a flip turns out.
- **The social layer notices.** Clean flips reach the household, a robbery
  reaches the neighborhood, held stock gets noticed weekly, and Broker standing
  goes out on the reputation channel. A big enough day clears Curtis's $200
  volume filter, which is how the legal hustle finally shows up on his radar.

**Saves are v7.** v3 through v6 all migrate. The old string tier is dropped and
re-derived rather than trusted, so a v6 save lands on whatever the laptop and its
flip record actually justify.

**Balance, measured over 2,000 seeded runs.** Two new simulation strategies
(`flipper`, `broker`) work the board so the tier ladder can be measured instead
of asserted:

| Tier | Measured | Target from the design doc |
|---|---|---|
| 1 — Scrapper | **$37.9/day** | $30–50 |
| 2 — Flipper | **$71.3/day** | $60–100 |
| 3 — Broker | **$34.2/day** | $100–150 |

Tiers 1 and 2 land in band. **Tier 3 does not, and the reason is structural
rather than a tuning miss:** the ten-flip gate opens around day 11 of a 14-day
run, so Broker gets two or three days to earn, most of a bankroll is locked in
stock when the run ends, and the last days are spent on the final plan. Half of
907List-focused runs reach Broker (76 of 153), so the content is not unreachable
— it just cannot earn at the stated rate inside the run length. Reaching
$100–150/day would also make 907List the strongest income source in the game by a
wide margin: the best existing strategy, `legal_worker`, averages about $79/day.
Left as specified and reported rather than tuned around.

Existing strategies are unmoved: the eleven pre-v1.9b profiles sit within **3.5%**
of their v1.9a averages and the economy overall within **0.34%**. 401 tests pass
and 2,000 seeded runs finish with zero dead ends.

| Run | SHA-256 |
|---|---|
| `--total 200` | `d4474787bd02ce5b08c3a24bb10c3e738616c5367843bbc641e9b8026a0a8a25` |
| `--total 2000` | `ddd7669506d2e85cbcb1c5a1c9a7617211af928fcb2fbf09033a75c8c8af1d8f` |

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
- **Pherris Dickens** is recruited through the market, not hired off a list. Her lens counts money moving quietly; when her ledger reads far enough past Warm she turns up wherever the player is working. On the payroll she is worth one effective level of Intelligence on market reads, and she grows from a paid rumor source into a social territory manager and seeded network-income operator.
- **Simone Hart** is Curtis's independent partner, with her own trust, threat, leverage, and truce state.
- **Tone** gains territory-defense tiers and the Day 7+ Jacksonville chain.
- **Deshawn** is recruitable through an intact Goodie relationship or restitution. His higher tiers reduce recruiting costs, broker truces, and can stop Curtis's betrayal — and since v1.19 they are gated on his own disposition rather than on time served: Trusted for tier 2, Bonded for tier 3.

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
2. **Street** — Travel (three destinations: the district you are in, Home, and Leave Spenard), People, and the pre-unlock Street Market.
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

v1.14 adds no persisted state: the Tonk fullscreen flag and every accordion's
fold state are React session state and are never serialized. The schema stays
at version **10**.

v1.13 moved the schema to version **10** under local-storage key `907ogr_v10`.
The change is purely additive — the Stick slice, the criminal profile, and
per-plug suspicion all default in through `mergeDefaults` — so every v3
through v9 save loads, migrates, and plays with the new systems at zero.
(v1.9c and v1.12a changed no state; the v1.9c accordion fold state is React
session state and is never persisted.)

The loader continues to read `907ogr_v8`, `907ogr_v7`, `907ogr_v6`, `907ogr_v5`, `907ogr_v4`, and `907ogr_v3` once, migrate them to v9, and preserve:

- everything a v8 save had, plus The Nile defaulted in undiscovered, the gambling counters at zero, and Selam and Biniam arriving Neutral with empty ledgers

- every 907List field a v6 save had, plus the broker track defaulted in: old sales carry over as the flip count they would have been, and the old string tier (`"basic"` / `"upgraded"`) is dropped and re-derived rather than trusted

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

- Node tests: **676 passing** (637 through v1.18, 38 new in `tests/v1-19.test.js`,
  one new in `tests/v1-15.test.js` for the de-escalation behavior change)
- Deterministic simulations: **2,000 runs, zero crashes or dead ends**
- Simulation SHA-256: `1bd2c29905bcb3dd55adff32c6787b4f659e5629fa5d1f225f7cbf40272acc36`
  (`--total 2000`) and
  `114d08f7aaf1ab529e36af7716da69e311cbe23db13af96a91b79c290799b9db`
  (`--total 200`). **Both moved at v1.19 on purpose**, for the same two kinds of
  reason as v1.18. Bookkeeping: the per-NPC telemetry loop covers
  `EXPOSURE_NPC_IDS`, so Pherris's lens adds two keys per strategy block, and the
  build added two more so her gate could be measured. Gameplay: 907List profit
  reaches a new channel, she is recruitable, and the market strategies spend the
  cash and pay the wage. The v1.18 baselines were `9ae8cd3c…` / `b233d725…`.
- **The de-escalation refactor is hash-neutral.** Routing Deshawn's three
  hardcoded sites through `presenceEffectsFor` was measured on its own commit
  first: both hashes came back byte-identical to v1.18. It is not
  behavior-identical in principle — an arrested Deshawn no longer talks people
  down from a cell — but the simulation never lands an arrest on him and a
  de-escalatable encounter in the same run, so the case is pinned by a unit test
  instead of by the hash.
- Pherris's gate, measured: her `minScore` floor was chosen against 2,000 runs
  rather than designed. At 5 / 6 / 8 / 10 she recruits in **16.1% / 14.8% /
  10.8% / 7.2%** of runs, and in **83% / 80% / 69% / 44%** of the dedicated
  flipper strategy. **8 ships.** Below it she is close to automatic for anyone
  who touches the market; above it she stops being reachable by a player who
  trades as one activity among several. At 8 she is proven in 334 runs and hired
  in 215, **entirely inside the three market-leaning strategies and zero
  everywhere else** — which is the lens doing its job. Tone sits at 267/152.
- Build: `npm run build` completes in ~30ms with no circular imports
- Title art over the wire: 68KB at 375px, 145KB at 1280px, down from 1,976KB
- Viewports: 320×568, 360×640, 375×812, 414×896, 640×480, 768×1024, 834×1112,
  1024×768, 1280×720, and 1440×900 — all with zero horizontal overflow and no
  tap target under 44px
- Browser criteria: zero console errors, usable Phone/Hustle locked states,
  correct five-tab navigation, and no Babel in the page
- v1.9c browser pass: Phone opens with only Texts expanded at 375×667; Bills
  badge and row tones track due dates; a full-health sleep advances the clock
  with no popup while a delta-bearing action still shows its receipt and time
  band; the employed and jobless Home cards both render with live reasons
- v1.14 browser pass (Chromium, 320/375/430/768/1440): zero horizontal overflow
  and zero console errors on Home, Travel, the Spenard hub, and the Phone;
  Travel renders exactly three rows; the Phone still opens with one of five
  sections expanded; the learned accordion toggles `aria-expanded`. A hand of
  Tonk loaded mid-table renders fullscreen with the HUD and dock hidden and
  64×44 Quit/Back controls; playing a turn shows the opponent's card for ~1.9s
  and then clears it; Back restores the shell and "Back to the table" returns
  to it; a hand ending restores the HUD, the nav, and a "Hand Resolved" card.
  One pre-existing exception to the 44px rule stands: the HUD's Menu button is
  42px wide (38px at ≤360px), shipped that way since v1.12a and left alone
  because widening it is what the 320px overflow rule exists to prevent.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — file map, state shape, save migration, event card schema, and the constraints a change has to hold to. Start here.
- [STORY_BIBLE.md](STORY_BIBLE.md) — current character voices, relationship rules, and story continuity
- [VISION.md](VISION.md) — long-form design direction
- [ROADMAP.md](ROADMAP.md) — release history and future work
- [PROGRESSION_DESIGN.md](PROGRESSION_DESIGN.md) — progression and identity model

Release history lives in [PROJECT_STATUS.md](PROJECT_STATUS.md) and the ClickUp
[Build Changelog](https://app.clickup.com/90141007990/docs/2kyd583p-4054/2kyd583p-14874). Each
build is specified as its own ClickUp page and shipped as its own PR; there is no single
standing spec document.
