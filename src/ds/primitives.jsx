// 907Hustle presentational primitives.
//
// These are the parts of the UI that carry the game's look without knowing
// anything about the game: props in, JSX out, styled entirely by v05.css class
// names. They live here rather than in ui.jsx so a single definition serves
// both the shipped game and the synced design system — a component that
// renders one way in claude.ai/design and another way in the app is worse than
// no design system at all.
//
// React stays a global (window.React, loaded UMD from index.html) exactly as
// it does in ui.jsx: esbuild's default JSX factory emits React.createElement,
// which resolves to that global without an import. The design-system bundle
// relies on the same thing, so nothing here may import react.
//
// Everything in this file must stay free of window.GameCore. A primitive that
// reads game state is a screen, and belongs in ui.jsx.

// Chip glyphs. Inlined for the same reason the nav icons are: the HUD band
// paints on the first frame and must never wait on a font or a fetch.
const CHIP_ICONS = {
  fire: "M12 2c1.2 3.8 5.5 5.2 5.5 10a5.5 5.5 0 0 1-11 0c0-2.2 1-3.9 2.1-5.5.5 1.9 1.6 2.6 2.4 2.6C10 6.6 11 4.4 12 2",
  star: "M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 16.9 6.1 20.2l1.3-6.6L2.5 9l6.6-.8z",
  cash: "M12.9 2.5h-1.8v2.2c-2 .2-3.4 1.5-3.4 3.3 0 2 1.5 2.9 3.8 3.4 1.8.4 2.4.9 2.4 1.7 0 .9-.8 1.5-2.1 1.5-1.2 0-2.2-.5-2.8-1.3l-1.6 1.2c.7 1.1 1.9 1.8 3.4 2v2.2h1.8v-2.2c2.1-.2 3.6-1.5 3.6-3.4 0-2-1.5-2.9-3.9-3.4-1.8-.4-2.3-.9-2.3-1.6 0-.8.7-1.4 2-1.4 1.1 0 1.9.4 2.5 1.1l1.6-1.2c-.7-.9-1.7-1.5-3.1-1.7z",
};

/**
 * Primary header readout — one labelled value in the always-visible HUD band.
 * Used for the values the player must never have to go looking for: day, time,
 * district, and cash.
 *
 * `flash` plays a 400ms animation when the value changes; drive it from
 * useValueFlash so a load never flashes. `bare` drops the label to a
 * screen-reader-only node, for the top bar where the value speaks for itself;
 * `accent` tints that value (`amber` for the clock, `green` for money,
 * `head` for the day stamp, `muted` for the district).
 */
export function Hud({ label, value, danger, good, flash, bare, accent }) {
  return <div className={`hud-item${danger ? " danger" : ""}${good ? " good" : ""}${bare ? " bare" : ""}${accent ? ` accent-${accent}` : ""}`} data-flash={flash || undefined}><span className={bare ? "sr-only" : "k"}>{label}</span><span className="v">{value}</span></div>;
}

/**
 * Secondary-row pressure indicator (Heat/Dre/Respect). Same label/value shape
 * as Hud, but carries escalation tone instead of a single danger flag: `calm`
 * when the pressure is off, `escalated` when it is about to cost the player
 * something, and neither in between.
 *
 * `icon` prefixes the label with one of the built-in glyphs. `segments` —
 * `{ filled, total }` — swaps the numeric value for a segmented bar, which is
 * the right shape for a bounded pressure scale where the exact integer matters
 * less than how close it is to the top. The `value` text stays as the
 * accessible name either way, so a bar never hides the number from a reader.
 */
export function Chip({ label, value, tone, flash, icon, segments }) {
  const bar = segments && segments.total > 0;
  // The icon name doubles as a class so the stylesheet can colour the bar and
  // the value per pressure (Heat red, Respect gold) without a style prop.
  return <div className={`status-chip${tone ? ` ${tone}` : ""}${bar ? " has-bar" : ""}${icon ? ` icon-${icon}` : ""}`} data-flash={flash || undefined}>
    <span className="k">{icon && CHIP_ICONS[icon] && <svg className="chip-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={CHIP_ICONS[icon]} fill="currentColor" /></svg>}{label}</span>
    {bar
      ? <span className="chip-bar" role="img" aria-label={String(value)}>{Array.from({ length: segments.total }, (_, index) => <i key={index} className={index < segments.filled ? "on" : ""} />)}</span>
      : <span className="v">{value}</span>}
  </div>;
}

/**
 * Screen title band. Renders the back affordance only when `onBack` is given,
 * so a root screen and a nested one use the same component. The button and the
 * title share one column, so a subtitle that wraps stays beside the button
 * instead of running under it and out of the header band.
 */
export function PageHead({ title, sub, onBack }) { return <div className="page-head">{onBack && <button className="back-btn" onClick={onBack}>← Back</button>}<div className="page-head-text"><h1>{title}</h1><p>{sub}</p></div></div>; }

/** One label/value line in a result readout — what an action just cost or paid. */
export function Outcome({ label, value }) { return <div className="outcome"><span className="muted">{label}</span><b>{value}</b></div>; }

/**
 * Full-width entry card into a section of the game. Carries a description, so
 * it is the right choice when the player needs to know what a place *is*
 * before opening it. When they already know and just need the list, use
 * MenuRow.
 */
export function CategoryCard({ title, status, description, onClick, disabled }) { return <button className={`card category-card${disabled ? " locked" : ""}`} disabled={disabled} onClick={onClick}><div className="card-title">{title}<small>{status}</small></div><p>{description}</p><span className="category-arrow">Open →</span></button>; }

/**
 * Menu-hub row. Shorter than CategoryCard: hubs list destinations, and a wall
 * of paragraphs is the density problem this component exists to remove.
 * `tone` marks a row that carries pressure — `warn` for something due, `bad`
 * for something already overdue.
 */
export function MenuRow({ title, status, description, onClick, disabled, tone }) { return <button className={`menu-row${tone ? ` ${tone}` : ""}${disabled ? " locked" : ""}`} disabled={disabled} onClick={onClick}><span className="menu-row-main"><b>{title}</b>{description && <small>{description}</small>}</span><span className="menu-row-meta">{status}<span className="menu-row-arrow" aria-hidden="true">›</span></span></button>; }

/**
 * Compact stat readout in a tile grid — the unit the situation block is built
 * from. `note` adds a third line of context under the value; `text` switches
 * the value to prose sizing for tiles whose value is a word rather than a
 * number.
 */
export function StatTile({ label, value, note, tone, text }) { return <div className={`stat-tile${tone ? ` ${tone}` : ""}${text ? " text" : ""}`}><span className="k">{label}</span><span className="v">{value}</span>{note && <span className="n">{note}</span>}</div>; }

/**
 * A place the player can travel to, with its price of admission stated up
 * front: what it is for, what it costs, and how much of the day it takes.
 * `reason` prints under the button — use it to say why a locked place is
 * locked rather than leaving the player to guess.
 */
export function PlaceAction({ title, status, purpose, cost, time, disabled, reason, onClick }) {
  return <div className={`card area-card${disabled ? " locked" : ""}`}><div className="card-title">{title}<small>{status}</small></div><p>{purpose}</p><div className="area-meta"><span>Cost {cost}</span><span>{time}</span></div><button className="btn full secondary" disabled={disabled} onClick={onClick}>{disabled ? "Unavailable" : "Go"}<span className="action-copy">{reason}</span></button></div>;
}

/**
 * Backdrop + dialog shell for every popup in the game. Supplies the role,
 * modal semantics, and accessible name; the caller supplies the body.
 * `className` is appended to the dialog and, suffixed with `-backdrop`, to the
 * backdrop — that pair is how variants like the confirm prompt restyle both
 * layers from one prop. Omit `onClose` for a modal the player must answer.
 */
export function Modal({ title, children, onClose, className = "" }) {
  return <div className={`modal-backdrop ${className ? `${className}-backdrop` : ""}`}><div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
    <div className="modal-head"><h2>{title}</h2>{onClose && <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>}</div>
    {children}
  </div></div>;
}
