import { CategoryCard } from "907hustle-game";

// See StatTile.tsx — v05.css paints the dark ground on `body`.
const shell = {
  background:
    "repeating-linear-gradient(118deg,rgba(255,255,255,.018) 0 1px,transparent 1px 7px)," +
    "radial-gradient(circle at 20% 0,rgba(211,41,32,.11),transparent 35%),#070707",
  color: "#f2f0eb",
  padding: "10px",
};

/**
 * The canonical use: an entry card whose description is doing real work,
 * because the player has not been here before and the name alone does not say
 * what it is.
 */
export const Entry = () => (
  <div style={shell}>
    <div className="scroll">
      <CategoryCard
        title="Operations"
        status="3 blocks"
        description="Assign soldiers, hold territory, and collect what it earns."
      />
    </div>
  </div>
);

/** Locked. The reason lives in `status` and `description`, never left implied. */
export const LockedCard = () => (
  <div style={shell}>
    <div className="scroll">
      <CategoryCard
        title="The Nile"
        status="Locked"
        description="Downtown's card room. You need an introduction first."
        disabled
      />
    </div>
  </div>
);

/**
 * A section index. Once a list gets much longer than this, or the names start
 * explaining themselves, switch to MenuRow — a screen of stacked descriptions
 * is harder to scan than a list of names.
 */
export const SectionIndex = () => (
  <div style={shell}>
    <div className="scroll">
      <CategoryCard
        title="Finances"
        status="$1,240"
        description="Debt, protected cash, and what the week still owes."
      />
      <CategoryCard
        title="People"
        status="4 known"
        description="Crew, contacts, and the ones keeping score."
      />
      <CategoryCard
        title="Recovery"
        status="78/100"
        description="Sleep it off, patch up, or cool the heat down."
      />
    </div>
  </div>
);
