# 907Hustle: One Good Run — Expanded Vision

## v1.4 branch direction

The `codex/v1-4-week-zero-early-game` branch reworks the opening without changing
the v3 save key. Fresh characters enter a required Street Name, start with $100
clean cash and no Dre relationship, and establish themselves through Week Zero.
Three shifts, four physically visited locations, and two eligible neighborhood or
workplace contacts make Dre's approach available after the next completed shift.

That approach begins a seven-calendar-day pressure phase whether the player takes
the money or refuses it. The run's checkpoint is therefore dynamic, not a fixed
Day 7 gate. Taking the offer creates $1,200 due at that checkpoint; refusing is
final and creates no debt. Keep Moving remains a separate future feature.

Energy is an internal pacing reserve of four points per day. It is surfaced only
where it explains an immediate choice, such as coffee, an unavailable action, or
One More Thing. It is never a persistent HUD bar. Night actions open an explicit
end-day confirmation before markets, obligations, identity evaluation, and the
calendar roll forward.

## Implemented v0.9 vertical slice

The current build begins with a genuine fresh arrival rather than inherited criminal infrastructure. The family home is temporary shelter with understandable boundaries; legal work, training, exploration, transit, relationships, petty theft, gambling, trading, and optional property compete for the same four daily time parts. North Star Garage is earned and optional. Street Read recognizes meaningful first accomplishments without replacing Street Identity or Operation Score. These are implemented systems, not future targets; exact scope is recorded in `ALPHA_V0.9.md`.

A classless single-player street-life and organization-management RPG set in
Anchorage. Torn is a reference for *activity breadth* only; 907Hustle's identity
is authored single-player consequence — neighborhood continuity, gang influence,
territory, relationships, and the pressure of coordinating everything you earn.

This document is the design target. `ROADMAP.md` says which build delivers what,
and `PROJECT_STATUS.md` says what actually exists today.

---

## 1. Core fantasy

You start at the bottom: a street name, $100 clean cash, no debt, no class, no
vehicle, few contacts, weak access, and one neighborhood where people are just
starting to notice you. Dre enters only after you establish a daily life.

You do not get stronger so much as you **change your daily life**. Progress shows
up as more places you can enter, better transport, stronger suppliers, larger
purchases, reliable legal income, equipment, trusted relationships, crew,
protected storage, credit, territory, information, and influence.

**Every improvement creates a responsibility.** Capability rises while your
schedule, expenses, relationships, and exposure get harder to manage. Early
problems come from lacking access. Later problems come from coordinating it.

The end state: **more opportunities than you have time for.** That pressure is
the management game.

---

## 2. Week Zero and the dynamic checkpoint

Week Zero teaches the neighborhood before lender pressure starts. The player
works three shifts, physically visits four unique locations, and meets two
eligible workplace or Night Owl contacts. Dre approaches after the next shift.
The choice starts the pressure phase and sets a checkpoint seven calendar days
later. Operation Score records what the player built, paid, protected, controlled,
and damaged at that run-specific checkpoint.

At the future continuation checkpoint the player may eventually pick:

**Finish the Run** — lock the final Operation Score, show the ending and summary,
allow leaderboard submission later.

**Keep Moving** — lock the Operation Score as a checkpoint, then continue
the *same save* into open-ended play. Money, relationships, access, vehicles,
crew, territory, debts, injuries, Heat, and reputation all carry. Longer-term
lenders, districts, cities, employment, and organization management open up.

One continuous world. The checkpoint stays meaningful without forcing the
character's life to end. Keep Moving is still a future feature and is not part of
the v1.4 early-game rework.

---

## 3. Classless creation

New characters begin with a required Street Name, equal attributes, **no edge or
class**, and no permanent activity restrictions. Nothing is locked off by an
opening choice.

> "You do not choose what the block calls you. The week decides."

Existing saves carrying Silver-Tongued Hustler, Steady-Hand Shooter, or the
legacy Strategist keep loading. New saves are classless after the migration.

---

## 4. Attributes

Six core attributes, each starting at 2.

| Attribute | Governs |
|---|---|
| **Strength** | Melee damage, carrying capacity, hard labor, physical intimidation, moving or protecting heavy product |
| **Endurance** | Maximum Health, injury recovery, long shifts, training tolerance, jail resilience, reduced penalties from repeated physical actions |
| **Reflexes** | Escaping, shoplifting, firearm handling, driving, avoiding searches, fast robbery choices |
| **Presence** | Negotiation, recruitment, relationships, job interviews, supplier confidence, defusing confrontations |
| **Insight** | Trading reads, gambling reads, scouting, detecting setups, market intelligence, recognizing false rumors |
| **Discipline** | Job attendance, training consistency, debt reliability, crew leadership, following plans, reducing penalties from neglected obligations |

### Compatibility derivation

The three shipped ratings become **derived values**, not stored ones:

- **Combat** ← Strength, Endurance, Reflexes
- **Charisma** ← Presence, primarily, with Discipline
- **Intelligence** ← Insight, primarily, with Discipline

Only **18 sites** in `game-core.js`, `ui.jsx`, and the tests read
`stats.combat/charisma/intelligence`. Exposing the three as selectors over the
six means the migration changes one derivation function rather than every call
site, and legacy saves hydrate by inverting the derivation.

The six live on a dedicated Character or Status screen. **Never on the main
HUD** — that surface is already at capacity with Day/Time, Cash, and Heat.

---

## 5. Proficiencies

Attributes are general capability. Proficiencies are practiced activity: Trading,
Firearms, Brawling, Theft, Driving, Fitness, Employment, Streetwise, Gambling,
Leadership.

They improve through **meaningful use**. A profitable sale improves Trading;
surviving a gun confrontation improves Firearms; a completed shift improves
Employment; resolving a contact job improves Streetwise; paying and managing crew
improves Leadership.

Repeating the same low-risk action gives diminishing or zero growth within a day.
Idle clicking, buying and reselling at a loss, and trivial repeated actions must
never farm progress. This is the same anti-grind stance as `PROGRESSION_DESIGN.md`.

---

## 6. Street Identity

You pick a Street Name, but the neighborhood starts you **Unproven**. Identity is
earned by behavior and is purely descriptive — it never blocks an activity.

Five categories, tracked in a behavior ledger:

| Identity | Earned by |
|---|---|
| **Mover** | Profitable sales, supplier negotiation, bulk purchases, market intelligence, reliable dealer business |
| **Earner** | Legitimate work, training, steady debt payments, attendance, dependable promises |
| **Stickup** | Dealer robbery, Quick Score, fighting, intimidation, weapon use |
| **Connector** | Relationships, favors, recruitment, information sharing, contact jobs |
| **Wild Card** | Mixed behavior with no dominant category, frequent changes of approach, unpredictable decisions |

**First assignment:** evaluate at Day 2 Night once at least six meaningful actions
are recorded. With fewer than six, wait for the eighth meaningful action.

**Recalculation:** once each Night. A new identity replaces the current one only
when it leads by **at least 25%**, clears a minimum raw margin, and stays ahead
across **two consecutive** nightly evaluations. Wild Card applies when the top two
stay close.

### Benefits — modest and situational

- **Mover** — extra supplier dialogue, better market-context previews, an
  occasional negotiation option, faster dealer-standing growth.
- **Earner** — better employer opportunities, more favorable credit
  conversations, improved reliability callbacks, occasional lower Heat through
  legal cover.
- **Stickup** — extra intimidation choices, better danger previews, faster
  recognition among violent contacts, access to robbery-focused events.
- **Connector** — extra favor and introduction options, relationship callbacks,
  contact-based information, improved recruitment.
- **Wild Card** — flexible event responses, occasional stat substitution, unusual
  contacts, reduced penalty for changing strategy.

Identity changes dialogue, event eligibility, and how people describe you. It is
**never a hidden permanent class**.

---

## 7. Three progression layers, kept apart

| Layer | What it does | Scope |
|---|---|---|
| **Stats and Proficiencies** | Improve your chance of succeeding | Persist with the character |
| **Street Read** | Run-level experience; unlocks convenience and selected strategic options | Resets each scored run |
| **Operation Score** | Grades the operation's condition at the Day 7 checkpoint | Locked at the checkpoint |

Street Read rewards **first-time milestones**, never button presses: first
profitable sale, first sale in a district, first completed job, first training
milestone, first survived encounter, first dealer relationship, first successful
robbery, first recruited crew member, meaningful Dre payments, territory,
story-chain progress, transport upgrades, new product access, Day 7 preparation.

Full specification in `PROGRESSION_DESIGN.md`, including the argument for
replacing the XP ladder with three competing reputations instead.

---

## 8. Access is the power curve

**Stats improve chances. Access determines which possibilities exist at all.**
This is the central design claim of the whole vision.

### Transportation

| Tier | Opens | Costs |
|---|---|---|
| On foot | Spenard | Limited cargo, full travel time, no upkeep |
| Bus pass | Downtown | Predictable fare, travel still costs time, limited cargo |
| Borrowed ride | Temporary reach through a relationship or favor | Creates an obligation; can disappear after conflict |
| Cheap car | Industrial Service Roads | Fuel, repairs, tickets, theft exposure |
| Reliable vehicle | Longer routes, larger purchases, crew assignments | Greater maintenance |
| Regional travel | Mat-Su, Fairbanks, Juneau | Transport **plus** a contact, supplier, job, or story reason |

A car alone must never reveal every Alaska location. Mat-Su wants a roadworthy
vehicle and a known contact; Fairbanks wants money, time, and a reliable route;
Juneau wants air or ferry access.

### Supply

A known dealer opens small purchases. Fair dealing builds standing. Reliable
volume opens better prices. Credit opens larger purchases. Betrayal and robbery
damage or remove supply. Better suppliers expect volume, payment, discretion, or
favors.

### Social

Relationships open information, transport, shelter, care, contacts, and exit
plans. Crew opens territory and complex operations. Employer trust opens
dependable shifts and legal references. Street standing opens private games, back
rooms, introductions, and higher-level deals.

### Property

Safehouse protects cash and product. Storage raises capacity. Security cuts
losses. Recovery improves treatment. Operations upgrades support coordination and
intelligence.

---

## 9. Places and activities

**Spenard becomes a dense starting hub** before the map ever grows: North Star
Garage, Night Owl Mini-Mart, the Wash & Go, a neighborhood gym, a pawn and gear
shop, a day-labor pickup point, a bus stop, a dice game, a clinic, apartments and
relationship locations, small employers, dealer corners, and convenience stores.

Every location needs a small set of useful actions and recurring people. **No
empty map destinations.**

**Legitimate work** pays dependable money, builds Employment proficiency and
employer reputation, can provide legal cover, and opens contacts and access — at
the cost of parts of day, attendance obligations, schedule conflicts, missed
illegal opportunities, possible termination, and the temptation to steal from the
employer. First prototype: **Ship Creek Day Labor** — Morning, modest guaranteed
pay, one part of day, may lower Heat, builds standing, can become a recurring
shift.

**Training** buys future capability and no immediate income: weights for
Strength, conditioning for Endurance, agility drills for Reflexes, social
practice for Presence, market study for Insight, routine attendance for
Discipline. Parts of day are the limiter — **do not add an Energy bar**.
Endurance influences training efficiency instead of duplicating the time economy.

**Shoplifting** yields small goods, consumables, resellable items, Theft
proficiency, and occasional information — against Heat, store bans, employer
consequences, injury, confiscation, character callbacks, and damage to
straight-facing relationships. The location remembers the attempt.

**Gambling** starts as one informal Spenard dice game: one table, one host,
limited stakes, several social outcomes. Cash swings, Insight and Presence
checks, contacts, debt opportunities, conflict, rumors. Compact beats a casino
interface.

---

## 10. Crime

Faster gains, stronger consequences. Eventually: Quick Score, dealer robbery,
shoplifting, burglary, vehicle theft, stickups, crew operations, territory
actions.

**Every crime connects to a person or place, Heat, injury, retaliation, lost
access, reputation, product or cash, and future callbacks.** The same target
remembers fair business, robbery, betrayal, and repetition. This is the rule Kip
Sallis exists to prove.

---

## 11. Debt and credit

Dre is the opening lender, not the only one. You begin in debt and cannot remove
that opening condition.

After repayment Dre may offer another loan, better terms, a larger principal,
supplier access, a favor arrangement — or a refusal based on poor reliability.

Future lenders differ by loan size, interest, due date, collateral, willingness to
use violence, reputation requirements, product access, territory ties, and
relationship consequences.

**Anti-arbitrage rules.** Limit concurrent notes. Track payment reliability. Gate
new credit on history. Let lenders know about some of your other debts. Give each
loan a purpose and a pressure. Never allow indefinite profit from borrowing off
one lender to repay another.

---

## 12. Relationships and reputation

Reputation is **character-specific**, not a global meter. Dre tracks payment
reliability, promises, loan history, and respect for terms. Rook tracks pressure,
respect, territory conflict, and public reputation. Dealers track standing,
volume, fair business, robbery, betrayal, and reliability. Employers track
attendance, performance, theft, honesty, and references. Crew track wages,
leadership, risk exposure, assignments, loyalty, and protection.

Keep the values behind the scenes. Show concrete behavior and recent status
through dialogue, cards, access, and history.

**Mara is the prototype for every future relationship**: she has an independent
goal, the player can help or endanger it, her help has limits, she remembers, she
can leave, romance is one possible direction, and friendship, distance, and
separation are all complete outcomes.

---

## 13. Heat, arrest, and jail

Heat is exposure. **No Heat number should trigger an automatic arrest** — high
Heat raises the chance and severity of encounters instead.

Arrests come from failing a risky crime, carrying exposed product during a stop,
repeated high-Heat actions, ignoring police presence, someone informing, or
driving with unresolved vehicle problems.

Jail is a setback, not an ending: lost parts of day, bail, confiscated cash or
product, missed work, missed debt deadlines, crew acting without you, relationship
reactions, lender pressure, changed employer standing. You leave poorer, later,
and under more pressure — **but with options**.

---

## 14. Obligations — the anti-snowball system

Every major upgrade carries upkeep. A car wants fuel, repairs, tickets, and
carries theft exposure. A job wants schedule, attendance, and employer
expectations. A relationship wants time, boundaries, and kept promises. Crew want
wages, protection, and leadership. Territory wants defense and crew assignments
against rival pressure. A safehouse wants repairs, security, and attracts
attention. Credit wants deadlines, interest, and trust. A better supplier wants
volume, timely payment, discretion, and favors.

Crew wages already work this way — `wageDue` accrues in the daily tick and unpaid
wages cost loyalty. **Every new obligation should follow that same pattern**
rather than inventing a parallel system.

---

## 15. Design rules

1. Every activity consumes time, money, risk, access, or obligation.
2. Every recurring person remembers meaningful treatment.
3. Stats improve chances.
4. Relationships, assets, and reputation create access.
5. Street Read rewards meaningful variety.
6. Operation Score grades the Day 7 state.
7. Street Identity describes behavior and stays flexible.
8. New systems connect to at least two existing systems.
9. New places need recurring purpose and recognizable people.
10. The player should feel progress through changed daily life.
11. Legal, illegal, social, and mixed survival strategies all stay viable.
12. **The world stays dense before it becomes large.**
