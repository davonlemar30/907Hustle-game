---
category: HUD & Status
---

Compact stat readout in a tile grid — the unit a situation block is built from.

Where `Hud` and `Chip` live in the fixed header, `StatTile` is what a screen body
uses to answer "what do I have?" at a glance. Tiles are meant to be laid out in a
grid several across; a single tile on its own usually wants to be an `Outcome`
line instead.

The grid container is `.stat-row` — an auto-fit grid with a 78px minimum track,
so it reflows from four across down to two on a narrow phone without any work
from the caller.

```jsx
<div className="stat-row">
  <StatTile label="Cash" value="$1,240" note="$300 protected" tone="good" />
  <StatTile label="Health" value="42/100" note="Hurt" tone="bad" />
  <StatTile label="Crew" value={3} note="1 idle" tone="warn" />
  <StatTile label="Standing" value="Broker" text />
</div>
```

`tone` marks a tile as good news (`"good"`), something to watch (`"warn"`), or a
problem (`"bad"`). Leave it off for a neutral reading — a grid where every tile is
toned reads as noise and none of them stand out.

`text` switches the value to prose sizing. Use it whenever the value is a word
rather than a number, or the large numeric styling will make a short word look
oversized.
