---
category: HUD & Status
---

Primary header readout — one labelled value in the always-visible HUD band.

907Hustle keeps four things on the primary HUD line: the day stamp, the clock,
the district, and cash. Everything else belongs one tap away in the status drawer
or on Home. Adding a fifth `Hud` to the primary row is the most common way to make
this UI feel cluttered — reach for `Chip` instead, which is the secondary pressure
row and is designed to appear and disappear.

`value` is a node, not a string, so a readout can carry its own inline detail
(the day HUD embeds a slot-pip strip after the text).

The top bar uses the `bare` shape: the label goes screen-reader-only and `accent`
tints the value, because "DAY 12" and "$3,870" already say what they are. A
labelled readout is for the status drawer, where a column of bare numbers would
be unreadable.

```jsx
<div className="hud primary-hud">
  <Hud label="Day" value="DAY 12" bare accent="head" />
  <Hud label="Time of day" value="Evening" bare accent="amber" />
  <Hud label="District" value="Spenard" bare accent="muted" />
  <Hud label="Cash" value="$1,240" bare accent="green" flash="good" />
</div>
```

`flash` plays a 400ms animation for a value that just changed — `"good"` or
`"bad"`. Drive it from a change detector rather than render state, so loading a
saved run never flashes. It is suppressed under `prefers-reduced-motion`.

`danger` and `good` add classes that `v05.css` does not currently style, so they
are inert — use `flash` to draw the eye instead.
