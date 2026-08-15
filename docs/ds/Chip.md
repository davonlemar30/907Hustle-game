---
category: HUD & Status
---

Secondary-row pressure indicator — Heat, Debt, Respect.

A `Chip` is the same label/value shape as `Hud` but carries escalation tone
instead of sitting on the primary line. The row it lives in is progressive: it
renders only once something on it is actually applying pressure, so an early-run
screen shows one calm HUD line instead of inheriting a late-run operator's chrome.
Follow that rule when composing — a chip row of permanently-present chips defeats
the point.

Tone is a three-state scale, and the middle state is the absence of a tone:

- `"calm"` — the pressure is off (debt cleared, heat low)
- omitted / `""` — present but not urgent
- `"escalated"` — about to cost the player something

```jsx
<div className="hud chip-row">
  <Chip label="Heat" value="9/15 · Burning" tone="escalated" flash="warn" />
  <Chip label="Debt" value="Due tonight" tone="escalated" />
  <Chip label="Respect" value={4} />
</div>
```

`flash="warn"` is the only flash a chip is styled for, and it is suppressed under
`prefers-reduced-motion`.
