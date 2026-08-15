import { PlaceAction } from "907hustle-game";

// See StatTile.tsx — v05.css paints the dark ground on `body`, which a preview
// card does not have, so each story restates it.
const shell = {
  background:
    "repeating-linear-gradient(118deg,rgba(255,255,255,.018) 0 1px,transparent 1px 7px)," +
    "radial-gradient(circle at 20% 0,rgba(211,41,32,.11),transparent 35%),#070707",
  color: "#f2f0eb",
  padding: "10px",
};

/**
 * The canonical use: a destination that states both costs before the tap.
 * Time is the resource a run actually spends, so `time` is never omitted.
 */
export const Available = () => (
  <div style={shell}>
    <PlaceAction
      title="North Star Garage"
      status="Open"
      purpose="Buy gear and get work done on the car."
      cost="$5"
      time="1 slot"
    />
  </div>
);

/**
 * Locked. The button label swaps to "Unavailable" on its own, so `reason`
 * says what would unlock it rather than repeating that it is locked.
 */
export const Locked = () => (
  <div style={shell}>
    <PlaceAction
      title="The Nile"
      status="Downtown"
      purpose="High-stakes card room. Tonk and Cee-lo, real money."
      cost="$40"
      time="1 slot"
      disabled
      reason="You need an introduction from Curtis first"
    />
  </div>
);

/**
 * A travel screen — how these actually appear, several in a scroll body, with
 * the affordable and the out-of-reach sitting side by side.
 */
export const TravelScreen = () => (
  <div style={shell}>
    <PlaceAction
      title="Spenard Community Gym"
      status="Open"
      purpose="Train up. Costs a slot, pays back in what you can carry."
      cost="$10"
      time="1 slot"
    />
    <PlaceAction
      title="Blue Nile Wellness"
      status="Open"
      purpose="Patch yourself up before the night shift."
      cost="$60"
      time="1 slot"
    />
    <PlaceAction
      title="Auto Lot"
      status="Needs a ride"
      purpose="Nothing here moves without wheels of your own."
      cost="$5"
      time="1 slot"
      disabled
      reason="Take the People Mover to Downtown first"
    />
  </div>
);
