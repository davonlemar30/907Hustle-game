import { Chip } from "907hustle-game";

// See StatTile.tsx — v05.css paints the dark ground on `body`. Chips sit in the
// `.top` band under the primary HUD, so the stories reproduce that band.
const shell = {
  background:
    "repeating-linear-gradient(118deg,rgba(255,255,255,.018) 0 1px,transparent 1px 7px)," +
    "radial-gradient(circle at 20% 0,rgba(211,41,32,.11),transparent 35%),#070707",
  color: "#f2f0eb",
  padding: "10px",
};

/**
 * The pressure row under pressure — heat climbing, debt due tonight, and
 * respect worth showing. This is the row at its fullest; it renders at all
 * only because something on it is applying pressure.
 */
export const PressureRow = () => (
  <div style={shell}>
    <header className="top">
      <div className="hud chip-row">
        <Chip label="Heat" value="9/15 · Burning" tone="escalated" />
        <Chip label="Debt" value="Due tonight" tone="escalated" />
        <Chip label="Respect" value="11" />
      </div>
    </header>
  </div>
);

/**
 * The tone scale. The middle state is the absence of a tone — `calm` when the
 * pressure is off, nothing when it is present but not urgent, `escalated` when
 * it is about to cost the player something.
 */
export const Tones = () => (
  <div style={shell}>
    <div className="hud chip-row">
      <Chip label="Calm" value="Clear" tone="calm" />
      <Chip label="Neutral" value="4/15 · Building" />
      <Chip label="Escalated" value="Overdue" tone="escalated" />
    </div>
  </div>
);

/**
 * A quiet run. Debt cleared and heat low, so both chips read `calm` — the row
 * is informational rather than a warning.
 */
export const Calm = () => (
  <div style={shell}>
    <div className="hud chip-row">
      <Chip label="Heat" value="1/15 · Cold" tone="calm" />
      <Chip label="Debt" value="Clear" tone="calm" />
      <Chip label="Respect" value="3" />
    </div>
  </div>
);
