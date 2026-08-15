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

/**
 * Primary header readout — one labelled value in the always-visible HUD band.
 * Used for the three values the player must never have to go looking for:
 * day/time, cash, and heat.
 *
 * `flash` plays a 400ms animation when the value changes; drive it from
 * useValueFlash so a load never flashes. It is the only prop with styling
 * attached — see the note on `danger`/`good` in the type contract.
 */
export function Hud({ label, value, danger, good, flash }) {
  return <div className={`hud-item${danger ? " danger" : ""}${good ? " good" : ""}`} data-flash={flash || undefined}><span className="k">{label}</span><span className="v">{value}</span></div>;
}

/**
 * Secondary-row pressure indicator (Heat/Dre/Respect). Same label/value shape
 * as Hud, but carries escalation tone instead of a single danger flag: `calm`
 * when the pressure is off, `escalated` when it is about to cost the player
 * something, and neither in between.
 */
export function Chip({ label, value, tone, flash }) {
  return <div className={`status-chip${tone ? ` ${tone}` : ""}`} data-flash={flash || undefined}><span className="k">{label}</span><span className="v">{value}</span></div>;
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
