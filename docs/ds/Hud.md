---
category: HUD & Status
---

Primary header readout — one labelled value in the always-visible HUD band.

907Hustle keeps exactly three things on the primary HUD line: day/time, cash, and
whatever the run is currently about. Everything else belongs one tap away in the
status drawer or on Home. Adding a fourth `Hud` to the primary row is the most
common way to make this UI feel cluttered — reach for `Chip` instead, which is the
secondary pressure row and is designed to appear and disappear.

`value` is a node, not a string, so a readout can carry its own inline detail
(the day/time HUD embeds a slot-pip strip after the text).

```jsx
<div className="hud primary-hud">
  <Hud label="Day / Time" value="3 · Evening · Spenard" good />
  <Hud label="Cash" value="$1,240" good flash="good" />
</div>
```

`flash` plays a 400ms animation for a value that just changed — `"good"` or
`"bad"`. Drive it from a change detector rather than render state, so loading a
saved run never flashes. It is suppressed under `prefers-reduced-motion`.

`danger` and `good` add classes that `v05.css` does not currently style, so they
are inert — use `flash` to draw the eye instead.
