---
category: Navigation
---

Screen title band — title, one-line subtitle, and an optional back affordance.

Every full-screen surface in 907Hustle opens with a `PageHead`. The same
component serves a root screen and a nested one: pass `onBack` and the back
button renders, omit it and the title block takes the full width. That is the
whole navigation model — nested pages are full screens with a back button, not
stacks or drawers.

```jsx
<>
  <PageHead
    title="Safehouse"
    sub="Storage, protected cash, and upgrades"
    onBack={() => setPage("root")}
  />
  <div className="scroll">{/* screen body */}</div>
</>
```

The subtitle earns its place — it says what the screen is *for*, so the player
does not have to open something to find out. Write it as a short phrase, not a
sentence.

The back button and the title share one flex column, so a subtitle that wraps
stays beside the button instead of dropping underneath it. Do not reintroduce a
floated back button.
