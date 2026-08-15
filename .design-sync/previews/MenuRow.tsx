import { MenuRow } from "907hustle-game";

// See StatTile.tsx — v05.css paints the dark ground on `body`.
const shell = {
  background:
    "repeating-linear-gradient(118deg,rgba(255,255,255,.018) 0 1px,transparent 1px 7px)," +
    "radial-gradient(circle at 20% 0,rgba(211,41,32,.11),transparent 35%),#070707",
  color: "#f2f0eb",
  padding: "10px",
};

/**
 * The canonical use: a hub of destinations, scannable at a glance. Most rows
 * carry no description — that density is the whole reason MenuRow exists
 * alongside CategoryCard.
 */
export const Hub = () => (
  <div style={shell}>
    <div className="scroll">
      <MenuRow title="Contacts" status="4 known" />
      <MenuRow title="Recent History" status="Day 3" />
      <MenuRow title="Territory" status="2 blocks" />
      <MenuRow title="Safehouse" status="Yalonda's" />
    </div>
  </div>
);

/**
 * The tone axis: `warn` for something due, `bad` for something already
 * overdue, nothing at all for a row that is simply a destination.
 */
export const Tones = () => (
  <div style={shell}>
    <div className="scroll">
      <MenuRow title="Gear" status="6 available" />
      <MenuRow title="Rent" status="Due tomorrow" tone="warn" />
      <MenuRow
        title="Dre"
        status="Overdue"
        description="He is not going to keep asking"
        tone="bad"
      />
    </div>
  </div>
);

/**
 * A disabled row states its reason in `status`. A dead row with no explanation
 * reads as a bug rather than a lock.
 */
export const Disabled = () => (
  <div style={shell}>
    <div className="scroll">
      <MenuRow title="Soldiers" status="Need a lieutenant" disabled />
      <MenuRow title="The Nile" status="Locked" disabled />
      <MenuRow title="Operations" status="3 blocks" />
    </div>
  </div>
);

/** With descriptions, for a hub whose destinations are not self-explanatory. */
export const WithDescriptions = () => (
  <div style={shell}>
    <div className="scroll">
      <MenuRow
        title="Spenard Jobs"
        status="2 open"
        description="Clean work. Slow money, no heat."
      />
      <MenuRow
        title="907List"
        status="Broker"
        description="Flip what you find. Your standing sets the board."
      />
    </div>
  </div>
);
