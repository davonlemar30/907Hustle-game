---
category: Navigation
---

Full-width entry card into a section of the game.

`CategoryCard` carries a description, so it is the right choice when the player
needs to know what a section *is* before opening it — a first encounter, or a
section whose name does not explain itself. Once the list gets long or the names
are familiar, switch to `MenuRow`; a screen of stacked descriptions is harder to
scan than a list of names.

The card renders as a single button, so the whole surface is the tap target.

Cards go straight into the screen's `.scroll` body — there is no list wrapper of
their own.

```jsx
<div className="scroll">
  <CategoryCard
    title="Operations"
    status="3 blocks"
    description="Assign soldiers, hold territory, and collect what it earns."
    onClick={() => navigate("operations")}
  />
  <CategoryCard
    title="The Nile"
    status="Locked"
    description="Downtown's card room. You need an introduction first."
    disabled
  />
</div>
```

`status` is the short right-aligned state next to the title — a count, a price, or
`"Locked"`. Keep it to a couple of words; the description is where detail goes.

`disabled` dims the card and blocks the click. Say why in `status` or
`description` rather than leaving the player to guess.
