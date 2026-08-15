# Building with the 907Hustle design system

907Hustle is a dark, mobile-first crime/trading game set in an Anchorage-inspired
Spenard. The look is condensed uppercase type, near-black panels, hairline
borders, and a single red accent used sparingly for danger and emphasis.

## Setup: no provider, but you must paint the ground

Every component here is a pure function of its props. There is **no provider,
theme object, or context to wrap** — render them directly.

What you *do* have to supply is the page itself. `v05.css` paints the app
surface on `body`, and the components only paint their own panels. A screen that
does not set that ground renders dark panels on white, which is wrong every
time. Either let the stylesheet's `body` rule apply, or reproduce it:

```css
background:
  repeating-linear-gradient(118deg, rgba(255,255,255,.018) 0 1px, transparent 1px 7px),
  radial-gradient(circle at 20% 0, rgba(211,41,32,.11), transparent 35%),
  var(--black);
color: var(--white);
font-family: var(--ui);
```

## The styling idiom: this system's own class names, plus tokens

There are **no utility classes** and no style props. Style your own layout glue
with the stylesheet's existing class vocabulary and `var(--*)` tokens. Read the
stylesheet before inventing a name — most things you need already exist.

Layout containers the components expect:

| Class | Use |
|---|---|
| `.app` | screen shell (max-width 900px, header/body/nav grid rows) |
| `.top` | fixed header band — holds `Hud` and `Chip` rows |
| `.hud`, `.primary-hud`, `.chip-row` | the HUD grids |
| `.scroll` | the scrolling screen body — `MenuRow`, `CategoryCard`, `PlaceAction` go straight in |
| `.stat-row` | auto-fit grid for `StatTile` |
| `.outcome-grid` | two-column grid for `Outcome` |
| `.card`, `.card-title` | generic panel and its title row |
| `.btn` + `.full` / `.primary` / `.secondary` / `.ghost`, `.btn-row` | buttons |
| `.popup-lead`, `.muted`, `.sr-only` | body copy, de-emphasis, screen-reader text |

Tokens (all of these are defined; nothing else is):

- Surfaces — `--black` `--panel` `--panel2` `--panel3` `--line`
- Text — `--white` `--muted`
- Accents — `--red` `--red2` `--green` `--amber` `--cyan`
- Semantic — `--clean` `--dirty` `--success` `--danger`
- Type — `--head` (Anton, display) `--ui` (Barlow Condensed, everything) `--mono` (Share Tech Mono, numbers)
- Metrics — `--control-h`

Numbers are always `--mono`. Titles are always `--head`, uppercase.

**Four tokens are referenced by the stylesheet but never defined** — `--text`,
`--good`, `--warn`, `--bad`. Do not use them; they resolve to nothing. Use
`--white`, `--green`, `--amber`, `--red`.

Tone is a prop, not a class: `StatTile` and `MenuRow` take `tone`, `Chip` takes
`calm`/`escalated`. Leave tone off unless the thing is actually notable — a
screen where everything is toned communicates nothing.

## Where the truth lives

- `_ds/<folder>/styles.css` and its `@import` closure (`_ds_bundle.css` is the
  full stylesheet) — the authoritative class and token vocabulary.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component usage, including
  when to pick one component over its neighbour.
- `components/<group>/<Name>/<Name>.d.ts` — the exact prop contract.

## An idiomatic screen

```jsx
<div className="app">
  <header className="top">
    <div className="hud primary-hud">
      <Hud label="Day / Time" value="3 · Evening · Spenard" />
      <Hud label="Cash" value="$1,240" />
    </div>
    <div className="hud chip-row">
      <Chip label="Heat" value="9/15 · Burning" tone="escalated" />
    </div>
  </header>

  <PageHead title="Safehouse" sub="Storage, protected cash, and upgrades" onBack={back} />

  <div className="scroll">
    <div className="stat-row">
      <StatTile label="Protected" value="$300" note="Safe from robbery" tone="good" />
      <StatTile label="Storage" value="8/12" note="Slots used" />
    </div>
    <MenuRow title="Upgrades" status="2 available" onClick={openUpgrades} />
    <MenuRow title="Rent" status="Due tomorrow" tone="warn" onClick={openRent} />
  </div>
</div>
```
