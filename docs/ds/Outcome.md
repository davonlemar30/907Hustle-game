---
category: HUD & Status
---

One label/value line in a result readout — what an action just cost or paid.

`Outcome` is the smallest primitive in the system: a muted uppercase label with
its value stacked underneath in the mono face, inside a bordered box. It exists
so that every "here is what happened" surface in the game lines up, whether it
is an event popup, a job result, or a trade confirmation.

The container is `.outcome-grid` — a fixed two-column grid. Outcomes are meant
to be laid out in it in pairs, which is why the label stacks above the value
rather than sitting beside it.

```jsx
<Modal title="Shift complete" onClose={close}>
  <div className="outcome-grid">
    <Outcome label="Paid" value="$140" />
    <Outcome label="Time" value="1 slot" />
    <Outcome label="Heat" value="+1" />
    <Outcome label="Energy" value="−1" />
  </div>
</Modal>
```

An odd number of outcomes leaves the last cell half-width — pair them up where
you can.

Format the value before passing it — `Outcome` prints exactly what it is given,
including the sign and currency symbol. It carries no tone prop by design: a
result list stays neutral, and anything that needs colour belongs in a
`StatTile`.
