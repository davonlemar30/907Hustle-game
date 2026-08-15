// Prop contracts for the 907Hustle design system.
//
// Hand-written: the game is plain JavaScript, so there is no generated .d.ts.
// This file is the API contract the claude.ai/design agent codes against, so
// the unions here are the real class vocabulary in v05.css, not `string`.
// When a primitive's props change in src/ds/primitives.jsx, change them here.
//
// It lives in src/ (committed) rather than ds-dist/ (a gitignored build
// output) precisely because nothing regenerates it — `npm run build:ds` copies
// it next to the bundle for the converter to read.
import type * as React from "react";

/** Values `data-flash` is styled for on a HUD readout. */
export type HudFlash = "good" | "bad";
/** Escalation tones a status chip is styled for. */
export type ChipTone = "calm" | "escalated";
/** Pressure tones a stat tile is styled for. */
export type StatTileTone = "good" | "warn" | "bad";
/** Pressure tones a menu row is styled for. */
export type MenuRowTone = "warn" | "bad";

export interface HudProps {
  /** Short key printed above the value, e.g. "Cash". */
  label: React.ReactNode;
  /** The readout itself, e.g. "$1,240" or "Day 3 / Evening". */
  value: React.ReactNode;
  /**
   * Adds a `danger` class. NOTE: v05.css defines no rule for it, so this is
   * currently inert — prefer `flash="bad"` to mark a bad change.
   */
  danger?: boolean;
  /** Adds a `good` class. Inert for the same reason as `danger`. */
  good?: boolean;
  /** Plays a 400ms change animation. Respects prefers-reduced-motion. */
  flash?: HudFlash;
}
export declare function Hud(props: HudProps): React.JSX.Element;

export interface ChipProps {
  /** Which pressure this chip tracks, e.g. "Heat". */
  label: React.ReactNode;
  /** Its current reading, e.g. "9/15 · burning". */
  value: React.ReactNode;
  /** Omit entirely for the neutral middle state. */
  tone?: ChipTone | "";
  /** Plays a 400ms change animation. Respects prefers-reduced-motion. */
  flash?: "warn";
}
export declare function Chip(props: ChipProps): React.JSX.Element;

export interface PageHeadProps {
  /** Screen title. */
  title: React.ReactNode;
  /** One-line subtitle describing what the screen is for. */
  sub: React.ReactNode;
  /** Omit on a root screen — the back affordance renders only when given. */
  onBack?: () => void;
}
export declare function PageHead(props: PageHeadProps): React.JSX.Element;

export interface OutcomeProps {
  /** What was spent or gained, e.g. "Time". */
  label: React.ReactNode;
  /** The amount, e.g. "1 slot". */
  value: React.ReactNode;
}
export declare function Outcome(props: OutcomeProps): React.JSX.Element;

export interface CategoryCardProps {
  /** Section name. */
  title: React.ReactNode;
  /** Short right-aligned state, e.g. "3 open" or "Locked". */
  status: React.ReactNode;
  /** A sentence on what this section is for. */
  description: React.ReactNode;
  onClick?: () => void;
  /** Dims the card and blocks the click. */
  disabled?: boolean;
}
export declare function CategoryCard(props: CategoryCardProps): React.JSX.Element;

export interface MenuRowProps {
  /** Destination name. */
  title: React.ReactNode;
  /** Short right-aligned state, e.g. "$40" or "Closed". */
  status: React.ReactNode;
  /** Optional second line. Omit it to keep a long hub list scannable. */
  description?: React.ReactNode;
  onClick?: () => void;
  /** Dims the row and blocks the click. */
  disabled?: boolean;
  /** Marks a row carrying pressure. */
  tone?: MenuRowTone;
}
export declare function MenuRow(props: MenuRowProps): React.JSX.Element;

export interface StatTileProps {
  /** Stat name, e.g. "Respect". */
  label: React.ReactNode;
  /** The reading. */
  value: React.ReactNode;
  /** Optional third line of context under the value. */
  note?: React.ReactNode;
  /** Marks a stat that is good news or a problem. */
  tone?: StatTileTone;
  /** Switches the value to prose sizing, for word values rather than numbers. */
  text?: boolean;
}
export declare function StatTile(props: StatTileProps): React.JSX.Element;

export interface PlaceActionProps {
  /** Place name. */
  title: React.ReactNode;
  /** Short right-aligned state, e.g. "Open" or "Needs a ride". */
  status: React.ReactNode;
  /** What the player would go there to do. */
  purpose: React.ReactNode;
  /** Money cost, pre-formatted, e.g. "$5". */
  cost: React.ReactNode;
  /** Time cost, pre-formatted, e.g. "1 slot". */
  time: React.ReactNode;
  /** Swaps the button to "Unavailable" and blocks the click. */
  disabled?: boolean;
  /** Printed under the button — say why a locked place is locked. */
  reason?: React.ReactNode;
  onClick?: () => void;
}
export declare function PlaceAction(props: PlaceActionProps): React.JSX.Element;

export interface ModalProps {
  /** Dialog title; also its accessible name. */
  title: string;
  /** The dialog body. */
  children?: React.ReactNode;
  /** Omit for a modal the player must answer — the close button disappears. */
  onClose?: () => void;
  /**
   * Appended to the dialog, and suffixed with `-backdrop` on the backdrop, so
   * one prop restyles both layers. e.g. "confirm-modal".
   */
  className?: string;
}
export declare function Modal(props: ModalProps): React.JSX.Element;
