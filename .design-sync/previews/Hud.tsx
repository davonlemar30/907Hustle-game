import { Hud } from "907hustle-game";

// See StatTile.tsx — v05.css paints the dark ground on `body`. The HUD also
// lives in the `.top` header band, so these stories reproduce that band: it is
// the only place a Hud ever appears.
const shell = {
  background:
    "repeating-linear-gradient(118deg,rgba(255,255,255,.018) 0 1px,transparent 1px 7px)," +
    "radial-gradient(circle at 20% 0,rgba(211,41,32,.11),transparent 35%),#070707",
  color: "#f2f0eb",
  padding: "10px",
};

/**
 * The primary HUD band, exactly as the game carries it: day/time with its slot
 * pips, cash, and the two controls. Three readouts is the ceiling — a fourth
 * belongs in the status drawer or on Home.
 */
export const PrimaryBand = () => (
  <div style={shell}>
    <header className="top">
      <div className="hud primary-hud">
        <Hud label="Day / Time" value="3 · Evening · Spenard" good />
        <Hud label="Cash" value="$1,240" good />
        <button className="status-toggle">
          Status <span>View</span>
        </button>
        <button className="menu-btn">Menu</button>
      </div>
    </header>
  </div>
);

/**
 * A readout on its own. `value` is a node, so it can carry inline detail
 * rather than being limited to a formatted string.
 */
export const Single = () => (
  <div style={shell}>
    <div className="hud">
      <Hud label="Cash" value="$1,240" />
    </div>
  </div>
);

/**
 * A full four-up row, for a screen carrying more than the primary band does.
 * `.hud` is a four-column grid by default; `.primary-hud` above narrows it to
 * the day/time, cash, and controls layout.
 *
 * (There is deliberately no flash story: `flash` is a 400ms animation, so a
 * still frame captures nothing — see the docs for how to drive it.)
 */
export const FourUp = () => (
  <div style={shell}>
    <div className="hud">
      <Hud label="Cash" value="$1,380" />
      <Hud label="Health" value="61/100" />
      <Hud label="Respect" value="11" />
      <Hud label="Energy" value="3/5" />
    </div>
  </div>
);
