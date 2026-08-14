# Alpha v0.7.1: Playstyle Foundation

Alpha v0.7.1 is the current playable build of **907Hustle: One Good Run**.

It completes the story and playstyle foundation introduced in Alpha v0.7 by adding Goodie as a persistent dealer, turning the Stickup route into a playable option, and completing the Eli, Dre, and Curtis story chains.

## Build identity

- Build: Alpha v0.7.1
- Save version: 3
- Save key: `907ogr_v3`
- Active runtime: `index.html`, `v05.css`, `game-core.js`, `ui.jsx`
- Story registry: 43 beats across five chains
- Verification: 83 tests passed, 800 simulated runs completed, 0 dead ends

## What the player can do

During a seven-day run, the player can:

- Trade weed, shrooms, cocaine, and meth across Spenard, Downtown, and Industrial Service Roads
- Track cost basis and projected profit or loss
- Pay Dre, preserve working capital, and deal with missed terms
- Manage Health, Heat, cargo, equipment, protected storage, and the North Star Garage
- Recruit crew and prepare territory operations against Curtis
- Build or damage relationships through event choices and recurring callbacks
- Use Rob as an emergency recovery action
- Meet Goodie and choose between fair business, information, and robbery

## Goodie

Goodie is a named Spenard dealer working from the Wash & Go lot. He exists to make the Hustle and Stickup routes readable through the same relationship.

### Buy off Goodie

- Available in Spenard after his introduction
- Purchases weed or shrooms below the current local price
- Builds standing
- Better standing improves the discount

### Ask what's moving

- Unlocks after enough standing
- Provides a reliable product lead
- Uses one part of day

### Rob Goodie

- Available as a deliberate playstyle choice
- Independent of the Rob working-capital gate
- Uses combat ability, equipment, crew, Insight-equivalent logic, Heat, and robbery history

Possible rewards:

- Cash
- Weed or shrooms at zero cost basis

Possible consequences:

- Injury
- Increased Heat
- Curtis pressure
- Damaged dealer standing
- Retaliation
- Reduced Spenard weed and shrooms supply
- Mina trust loss
- Permanent loss of Goodie after two successful robberies

## Completed story chains

### Mina Vale

Mina's six-stage arc remains the primary relationship spine. Her story tracks how the player handles trust, public association, boundaries, danger, and her independent goal of getting a Ship Creek dispatch job.

### Eli “Shortcut” Ward

Eli now has five connected beats covering:

- Introduction
- Test route
- A changed route after spotting a tail
- A private service-road map
- A late-week decision about his place in the operation

### Dre Smooth

Dre now reacts to:

- The original terms
- The first successful payment
- Amount and timing of payment
- Day 4 due-date behavior
- Post-payoff choices
- The player's final payment reliability

### Curtis Foyer

Curtis now escalates through:

- Private information reaching his people
- Surveillance and pressure
- A weekly payment demand
- Interference
- Confrontation
- A final position based on territory, respect, resistance, and prior choices

### Goodie

Goodie's chain includes:

- Introduction
- Retaliation after robbery
- A branch involving Deshawn when the player built trust before betraying Goodie

## Event selection changes

The story system now favors beats rooted in the district where the player is standing. This prevents area-independent storylines from crowding out Spenard-specific characters such as Mina and Goodie.

Reactive events, such as Dre answering a payment, no longer count toward the anti-monopoly streak. The game can respond to player actions without delaying unrelated storylines.

## Balance and simulation

The latest simulation includes four profiles:

- Cautious
- Balanced
- Aggressive
- Stickup

Recorded results:

- 800 of 800 runs terminated
- 0 dead ends
- 332 dealer robberies across 200 Stickup runs
- Mina reached stage 4 in 48% of cautious runs and 54% of Stickup runs
- Aggressive travel-heavy agents reached Mina 0% because they did not return to Spenard

The district-gated story behavior is intentional. Human playtesting still needs to confirm that missing a local storyline feels like a consequence of travel choices.

## Known limitations

- Browser and mobile QA has not yet been recorded for v0.7.1
- The title image remains a large PNG
- React, ReactDOM, Babel, and fonts load from CDNs
- Starting Hustler and Shooter edges remain active until the classless v0.8 migration
- Street Read, jobs, training, dice, shoplifting, transportation, jail, and multiple lenders remain future work

## Recommended playtest

Run two complete human sessions:

1. Stay mostly in Spenard and engage with Mina, Goodie, Eli, and local events.
2. Travel frequently and observe which local stories are missed or delayed.

During both runs, test:

- Goodie's introduction
- Buy off Goodie
- Ask what's moving
- Successful and failed robbery
- Spenard supply reduction
- Mina's reaction to Goodie robbery
- Retaliation and betrayal callbacks
- Eli, Dre, and Curtis pacing
- Street Contacts navigation
- Mobile layout and title-screen scaling
