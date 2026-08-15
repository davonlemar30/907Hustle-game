import { Outcome } from "907hustle-game";

// See StatTile.tsx — v05.css paints the dark ground on `body`.
const shell = {
  background:
    "repeating-linear-gradient(118deg,rgba(255,255,255,.018) 0 1px,transparent 1px 7px)," +
    "radial-gradient(circle at 20% 0,rgba(211,41,32,.11),transparent 35%),#070707",
  color: "#f2f0eb",
  padding: "10px",
};

/**
 * The canonical use: result lines in an `.outcome-grid`, the two-column
 * container these are laid out in. Values arrive pre-formatted — Outcome
 * prints exactly what it is given, sign and currency symbol included.
 */
export const ShiftResult = () => (
  <div style={shell}>
    <div className="outcome-grid">
      <Outcome label="Paid" value="$140" />
      <Outcome label="Time" value="1 slot" />
      <Outcome label="Heat" value="+0" />
      <Outcome label="Energy" value="−1" />
    </div>
  </div>
);

/**
 * A trade. The component carries no tone by design, so a loss reads the same
 * as a gain — the sign in the value does the work.
 */
export const TradeResult = () => (
  <div style={shell}>
    <div className="outcome-grid">
      <Outcome label="Sold" value="12 × Blue Nile" />
      <Outcome label="Gross" value="$960" />
      <Outcome label="Curtis's cut" value="−$144" />
      <Outcome label="Net" value="+$816" />
    </div>
  </div>
);

/**
 * An odd count. The grid is a fixed two columns, so a third outcome leaves the
 * last cell half-width — worth seeing before you design around it.
 */
export const OddCount = () => (
  <div style={shell}>
    <div className="outcome-grid">
      <Outcome label="Rides taken" value="4" />
      <Outcome label="Today's fares" value="Covered" />
      <Outcome label="Status" value="Ready" />
    </div>
  </div>
);
