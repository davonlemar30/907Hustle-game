# 907Hustle: One Good Run — Story Bible

This is the writer-facing reference for the active **v1.8** runtime (`index.html` → `v05.css`, `game-core.js`, `encounters.js`, `ui.jsx`). Older prototypes and audit files are not canon.

## Continuity rules

- Fresh runs begin at Yalonda and Juan Hernandez's home. No street relationship is assumed.
- Mina Vale is a stranger until the player visits the Night Owl during Evening or Night.
- Curtis Foyer begins unaware. His attention comes from observable exposure, not the player's general reputation.
- Goodie begins unknown and is discovered in Spenard. He is a dealer, never a money launderer or finance lieutenant.
- Dre Smooth is optional. Refusing him or never finding him cannot stall Week Zero.
- Simone Hart is Curtis's independent partner, not his subordinate or a reward for defeating him.
- Pherris Dickens, Tone Bell, and Deshawn retain goals and loyalties outside their usefulness to the player.
- Garage scenes require garage control. Legacy saves may already have that continuity.
- The ending uses the current dynamic checkpoint. It does not force the calendar back to a literal Day 7.

## Writing standard

Use second person and present tense. Every authored scene should contain:

1. A concrete opening image: an object, gesture, vehicle, room, sound, or weather detail.
2. The immediate situation and why a decision is due now.
3. What the other person wants, fears, hides, or could lose.
4. A specific action or answer controlled by the player.

Avoid abstract openings, exposed score math, false binary morality, and choices where one humane option is surrounded by punishment buttons. Choice previews describe consequence categories without revealing percentages, hidden rolls, or relationship numbers. Results show what visibly happened, state the important mechanical effect in plain language, and leave a concrete detail for a later callback.

Street Identity changes interpretation, not personality or relationship truth. Mina notices consent and safety; Eli notices routes; Dre notices follow-through; Curtis notices exposure and posture; Goodie notices business and threat; Pherris notices ownership of information. Never treat identity as a permanent class.

As of v1.9a that paragraph is no longer only prose. Each of those noticing axes is a weight table in `src/data/npc-lenses.js`, applied to a ledger of what the character actually observed. Write to the axis: a scene where Mina learns you were careful with someone should produce a discretion observation, not a generic point of trust. See the Exposure System section of `ARCHITECTURE.md` for what a scene may record and who else hears about it.

## Character voices

### Mina Vale

Observant, concise, and hard to impress. Direct about safety and clean work. Warmth appears through remembered details and practical action, not declarations. She names boundaries plainly and can leave without becoming cruel. Her family name carries danger and leverage she did not choose.

Her Night Owl arc is:

1. `mina_intro` — **First Coffee**
2. `mina_shift_change` — **Twenty Minutes Past Close**
3. `mina_invitation` — **Four Hours and No Agenda**
4. `mina_boundary` — **Someone Said Your Name Wrong**
5. `mina_sedan_night` — **The Vale Call**
6. `mina_after` — **Aftermath**

Routine conversations at the current location are free. The Stage 3 date costs one part of day. Trust 2 represents dependable local confidence; trust 3+ permits high-trust outcomes and broker contact while phone service works.

Her final state must be exactly one of:

- `mina_stays` — she chooses continued proximity on her own terms.
- `mina_calls_home` — she uses the Vale connection without surrendering her agency.
- `mina_gone` — she leaves because the player made remaining unsafe or impossible.

### Curtis Foyer

Territorial, strategic, and patient. He works through sightings, reports, blocked access, public embarrassment, and negotiated dependency before direct violence. He has been tracking specific behavior and should name it.

His chain uses `curtis_mark`, `curtis_tax`, `curtis_cut`, and `curtis_day7`, with ambient crew sightings before direct contact. At attention 4 he offers paths that must sound genuinely different: pay for predictability, accept useful friendship, stay guarded, or reject his premise. Friendship is attractive and dangerous. A betrayal is a consequence of misplaced protection, not a random punishment.

### Simone Hart

Anchorage-born, formerly a hotel night auditor, and now the builder of a worker-screening and protection network. She is precise about schedules, vulnerable workers, and who gets to speak for whom. Respecting her autonomy builds trust. Poaching, threats, and treating her only as leverage raise threat. Her leverage can create a truce, but the choice to spend it belongs to her.

### Dre Smooth

Calm, controlled, and attentive to dates and amounts. He rarely threatens. Pressure comes through silence, revised terms, and access. He respects clean completion more than promises and distinguishes excessive force, soft handling, failure, and refusal.

Trust progression is Stranger → Reliable → Earner → Inner Circle. His five non-repeating backstory fragments cover Fairbanks, sobriety, his grandmother, and oil-rig years without turning into a single exposition speech. Missions should reveal how he evaluates judgment, not merely supply payouts.

### Goodie

Social, opportunistic, and always reading weapons, cash, crew, and confidence. He remembers fair business, regular customers, robbery, and restitution. His Atlanta history arrives after repeated business, never as an introduction dump. He sells, gives rumors, chokes supply, recognizes betrayal, and retaliates. He never offers laundering.

The `goodie_corner` chain covers introduction, customer trust, Atlanta backstory, standing rewards, betrayal recognition, and retaliation.

### Pherris Dickens

Information-focused and protective of her network. She distinguishes rumor, confirmation, and opinion. She wants credit, compensation, and authority over contacts she supplies. Tier 2 makes her a social territory manager; Tier 3 makes her network economically independent enough to create conflict with Simone and Curtis.

### Anton “Tone” Bell

Direct, restrained, and experienced with physical risk. He speaks in practical assessments, values preparation and stated limits, and dislikes reckless violence that creates exposure. His Jacksonville chain asks whether loyalty means protection, release, or leverage; none should read as a cosmetic branch.

### Deshawn

A mediator and recruiter whose credibility depends on whether the player treated Goodie's relationship as real. An intact relationship opens recruitment; restitution plus clean work can repair damage; calling betrayal “business” closes the door permanently. At high loyalty he can prevent a betrayal because people trust him, not because he is physically stronger.

### Eli “Shortcut” Ward

Talks in routes, timing, exits, vehicles, and distances. Eager to be useful, covering insecurity with excess practical detail. Responsibility builds loyalty. Rejection makes him guarded, not hostile.

### Yalonda Hernandez

Practical, observant, and protective of her household. Rent is part of trust but not the whole relationship. She recognizes routines, noise, strangers, and whether the player respects a shared home.

### Juan Hernandez

Eighteen, locally connected, and still deciding how much of Spenard's adult world he wants to inherit. He can connect the player to warehouse work, the gym, listings, and Dre without becoming a quest dispenser.

## Relationship authority

NPC state is authoritative and persistent:

- `npc.mina`: trust, stage, intro tone, clean-life risk, truth/betrayal flags, availability, outcomes.
- `npc.curtis`: attention 0–8, respect, relationship path, warnings, tax, friendship, betrayal.
- `npc.dre`: trust tier, missions, refusals, clean completions, backstory fragments.
- `npc.simone`: trust, threat, Pherris conflict, leverage, truce.

Do not infer these outcomes from rendered copy or duplicate them in UI-local state.

## Exposure and pressure

Curtis attention is legible because every point has a source:

- cumulative units sold first crossing 10, 25, and 50
- rolling four-part illegal revenue first reaching $600 and $1,200
- first conspicuous Spenard sale
- first named-NPC report
- first territorial or network escalation

Minor dealing below the first threshold is invisible. Tax takes 15% of nightly illegal gross and pauses ordinary attention growth at 5. Friendship gives two days of protection and a buyer premium, then creates betrayal eligibility after two days at attention 7. Guarded and rejection paths preserve independence differently.

Kieran Vale arrives only when Curtis attention is at least 6, cumulative sales reach 50, and Mina trust is at least 2. Protecting Mina, asking her to broker, or exploiting her name must feed directly into Mina's outcome.

## Crew arcs

- **Pherris Tier 1:** wage, daily rumor, Downtown buyer premium.
- **Pherris Tier 2:** social management with lower Heat and slower threat response.
- **Pherris Tier 3:** seeded network income and the Simone/Curtis conflict.
- **Tone Tier 1:** garage defense and loyalty-spend encounter resolution.
- **Tone Tier 2:** territory defense from Curtis pressure.
- **Tone Tier 3:** stronger defense with added Heat on active-management days.
- **Deshawn Tier 1:** de-escalation and weekly rent grace.
- **Deshawn Tier 2:** cheaper soldier recruitment and temporary Curtis truces.
- **Deshawn Tier 3:** betrayal prevention and lower managed-block Heat.

Non-field contacts do not consume crew capacity. Garage operations upgrades raise field capacity from two to four so Eli, Pherris, Tone, and Deshawn can coexist.

## Dre missions and Shark borrowers

Delivery, collection, enforcement, and intelligence missions consume one part of day and distinguish clean, excessive, soft, failed, and refused outcomes. Three refusals end mission offers for the run. Seeded results must remain reproducible.

Shark borrowers are written as people with circumstances, not risk labels:

- **Nora Pike** — lowest limit and clearest repayment path.
- **Jamal Briggs** — moderate volatility.
- **Kelsey Roy** — larger need and less schedule control.
- **Leon Grant** — highest limit and highest uncertainty.

The UI shows qualitative risk only. Default responses—Collect, Extend, Enforce, Forgive—must express a relationship stance as well as a financial choice. Enforcement adds Heat; collection and enforcement consume time; Dre receives his agreed share of collected interest.

## Time and causality

Substantial actions consume their declared time exactly once. Phone use, payments, local conversation, immediate first aid, listings, recruitment, assignments, equipment, and upgrades are free. Free actions can raise a consequence card but cannot roll random story progression or advance automatic timers.

This distinction is also a writing rule: free conversation may acknowledge existing consequences, but a new unrelated street event cannot appear merely because the player paid a bill or checked a text.

## Save migration

Schema v5 rewrites legacy character records, event IDs, visible history, and territory ownership once. Completed choices and stages do not replay. Existing clean cash remains clean. Goodie's dealer standing and robbery history survive, while finance-lieutenant and laundering access do not. Previously held employers become offers except for the last-worked eligible employer, which becomes active.
