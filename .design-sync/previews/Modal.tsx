import { Modal, Outcome } from "907hustle-game";

// Modal renders a `position:fixed` backdrop, which in the game covers the
// viewport. A preview card puts a `transform` on the cell, and a transformed
// ancestor becomes the containing block for fixed positioning — so the backdrop
// resolves against the cell instead of the viewport, the cell has no height of
// its own (the backdrop is out of flow), and the dialog centers on a collapsed
// box and overflows off the top.
//
// `stage` gives the overlay somewhere to live: its own transform makes it the
// containing block, and its height stands in for the viewport. This is preview
// scaffolding only — in the app the backdrop covers the screen and needs none
// of it.
const stage = (height: number) => ({
  position: "relative" as const,
  height,
  transform: "translateZ(0)",
  overflow: "hidden" as const,
});

/**
 * A confirmation. No `onClose`, so there is no × — the player has to answer
 * through the body's own controls. `className` restyles the dialog and, via
 * the `-backdrop` suffix, the backdrop behind it.
 */
export const Confirm = () => (
  <div style={stage(240)}>
    <Modal title="Abandon this run?" className="confirm-modal">
      <p className="popup-lead">
        Your current autosave will be replaced. This cannot be undone.
      </p>
      <div className="btn-row">
        <button className="btn secondary">Cancel</button>
        <button className="btn primary">Abandon</button>
      </div>
    </Modal>
  </div>
);

/**
 * The run menu — a dismissible modal. `onClose` renders the × control, which
 * is sized to a 44px minimum tap target.
 */
export const RunMenu = () => (
  <div style={stage(260)}>
    <Modal title="Run menu" onClose={() => {}}>
      <button className="btn full secondary">Save and quit</button>
      <button className="btn full ghost">Abandon run</button>
    </Modal>
  </div>
);

/**
 * A result readout — Modal supplying the shell, an `.outcome-grid` of Outcome
 * lines supplying the body. This is the composition most "here is what
 * happened" popups use.
 */
export const Result = () => (
  <div style={stage(400)}>
    <Modal title="Shift complete" onClose={() => {}}>
      <p className="popup-lead">
        You worked the counter at the Night Owl until close. Slow night, no
        trouble, and the register balanced.
      </p>
      <div className="outcome-grid">
        <Outcome label="Paid" value="$140" />
        <Outcome label="Time" value="1 slot" />
        <Outcome label="Heat" value="+0" />
        <Outcome label="Energy" value="−1" />
      </div>
    </Modal>
  </div>
);
