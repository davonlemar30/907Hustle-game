---
category: Navigation
---

A place the player can travel to, with its price of admission stated up front.

`PlaceAction` is the travel-screen counterpart to `CategoryCard`: same card shell,
but it commits to showing both costs before the player taps. That is deliberate —
time is the resource a run actually spends, and a destination that hides its slot
cost until after the tap is the thing this component exists to prevent. Always
pass both `cost` and `time`, pre-formatted.

```jsx
<PlaceAction
  title="North Star Garage"
  status="Open"
  purpose="Buy gear and get work done on the car."
  cost="$5"
  time="1 slot"
  onClick={() => travel("north_star")}
/>

<PlaceAction
  title="The Nile"
  status="Downtown"
  purpose="High-stakes card room."
  cost="$40"
  time="1 slot"
  disabled
  reason="You need an introduction from Curtis first"
/>
```

`reason` prints under the button and is how a locked place explains itself. When
`disabled` is set the button label swaps to "Unavailable" automatically, so
`reason` should say what would unlock it, not repeat that it is locked.
