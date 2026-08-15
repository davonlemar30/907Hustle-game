import { StatTile } from "907hustle-game";

// v05.css paints the page, not the parts: the dark ground, the scanline wash,
// and the red bloom top-left all live on `body`. Preview cards render on a
// white card surface, so each story restates that ground — otherwise these
// read as dark boxes floating on white, which is not how they ever appear.
const shell = {
  background:
    "repeating-linear-gradient(118deg,rgba(255,255,255,.018) 0 1px,transparent 1px 7px)," +
    "radial-gradient(circle at 20% 0,rgba(211,41,32,.11),transparent 35%),#070707",
  color: "#f2f0eb",
  padding: "10px",
};

/**
 * The canonical use: a situation block on Home, answering "what do I have?"
 * in one glance. `.stat-row` is an auto-fit grid, so this reflows on its own.
 */
export const SituationBlock = () => (
  <div style={shell}>
    <div className="stat-row">
      <StatTile label="Cash" value="$1,240" note="$300 protected" />
      <StatTile label="Health" value="78/100" note="Steady" />
      <StatTile label="Heat" value="4/15" note="Building" />
      <StatTile label="Energy" value="3/5" note="1 slot left" />
    </div>
  </div>
);

/**
 * The tone axis. Leave tone off for a neutral reading — a grid where every
 * tile is toned reads as noise and none of them stand out.
 */
export const Tones = () => (
  <div style={shell}>
    <div className="stat-row">
      <StatTile label="Neutral" value="12" note="No tone" />
      <StatTile label="Good" value="$2,400" note="Paid out" tone="good" />
      <StatTile label="Warn" value="Due Day 6" note="Rent" tone="warn" />
      <StatTile label="Bad" value="Overdue" note="Dre wants it" tone="bad" />
    </div>
  </div>
);

/**
 * `text` switches the value to prose sizing. Without it a short word gets the
 * large numeric treatment and looks oversized next to its neighbours.
 */
export const WordValues = () => (
  <div style={shell}>
    <div className="stat-row">
      <StatTile label="Standing" value="Broker" text />
      <StatTile label="District" value="Spenard" text />
      <StatTile label="Crew" value="Eli, Marcus" text />
      <StatTile label="Shift" value="Night" text />
    </div>
  </div>
);

/** A tile is legible without a note — drop it when there is nothing to add. */
export const WithoutNotes = () => (
  <div style={shell}>
    <div className="stat-row">
      <StatTile label="Day" value="3" />
      <StatTile label="Blocks" value="2" tone="good" />
      <StatTile label="Soldiers" value="5" />
      <StatTile label="Respect" value="11" />
    </div>
  </div>
);
