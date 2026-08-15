import { PageHead } from "907hustle-game";

// See StatTile.tsx — v05.css paints the dark ground on `body`.
const shell = {
  background:
    "repeating-linear-gradient(118deg,rgba(255,255,255,.018) 0 1px,transparent 1px 7px)," +
    "radial-gradient(circle at 20% 0,rgba(211,41,32,.11),transparent 35%),#070707",
  color: "#f2f0eb",
  padding: "10px",
};

/**
 * A nested screen: `onBack` renders the back affordance. This is the common
 * case — most surfaces in the game are reached from a hub.
 */
export const Nested = () => (
  <div style={shell}>
    <PageHead
      title="Safehouse"
      sub="Storage, protected cash, and upgrades"
      onBack={() => {}}
    />
  </div>
);

/** A root screen: no `onBack`, so the title block takes the full width. */
export const Root = () => (
  <div style={shell}>
    <PageHead title="Home" sub="Where you are and what is pressing" />
  </div>
);

/**
 * A subtitle long enough to wrap. The back button and the title share one flex
 * column, so the second line stays beside the button instead of dropping
 * underneath it and out of the header band.
 */
export const WrappingSubtitle = () => (
  <div style={{ ...shell, maxWidth: 360 }}>
    <PageHead
      title="Operations"
      sub="Assign soldiers, hold the blocks you have claimed, and collect what they earn each night"
      onBack={() => {}}
    />
  </div>
);
