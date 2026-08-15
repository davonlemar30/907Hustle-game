---
category: Navigation
---

Menu-hub row — one destination in a list, with its state on the right.

`MenuRow` and `CategoryCard` answer the same question at different densities.
Use `MenuRow` when the player already knows what these places are and just needs
the list: a hub of eight destinations built from `CategoryCard` is a wall of
paragraphs, which is exactly the density problem `MenuRow` exists to remove.
Reach for `CategoryCard` only when the description is genuinely load-bearing.

`description` is optional for that reason — drop it on a long list.

Rows go straight into the screen's `.scroll` body — there is no list wrapper of
their own.

```jsx
<div className="scroll">
  <MenuRow title="Contacts" status="4 known" onClick={openContacts} />
  <MenuRow title="Rent" status="Due tomorrow" tone="warn" onClick={openRent} />
  <MenuRow title="Dre" status="Overdue" description="He is not going to keep asking" tone="bad" onClick={openDebt} />
  <MenuRow title="Territory" status="Locked" disabled />
</div>
```

`tone` marks a row that carries pressure: `"warn"` for something due, `"bad"` for
something already overdue. Leave it off otherwise.

`disabled` dims the row and blocks the click. When a row is disabled, put the
reason in `status` (`"Locked"`, `"Need a crew"`) — a dead row with no explanation
reads as a bug.
