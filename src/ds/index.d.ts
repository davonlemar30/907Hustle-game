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
/** Colour roles the top HUD bar tints a bare readout with. */
export type HudAccent = "head" | "amber" | "green" | "muted";
/** Glyphs a status chip can prefix its label with. */
export type ChipIcon = "fire" | "star" | "cash";
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
  /**
   * Hides the label from sight (it stays for screen readers) and drops the
   * readout to one line. This is the top HUD bar's shape, where four values
   * share a single band and each one is self-describing.
   */
  bare?: boolean;
  /** Tints a `bare` readout. Ignored on a labelled one. */
  accent?: HudAccent;
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
  /** Glyph printed before the label. */
  icon?: ChipIcon;
  /**
   * Renders the reading as a segmented bar instead of text. Use it for a
   * bounded scale where nearness to the ceiling reads faster than the integer;
   * `value` still supplies the accessible name, so the number is never lost.
   */
  segments?: { filled: number; total: number };
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

/** Pressure tones a badge is styled for. */
export type BadgeVariant = "neutral" | "warning" | "danger";

export interface BadgeHeaderProps {
  /** The thing being counted, e.g. "Bills". */
  label: React.ReactNode;
  /** The count. 0 or omitted renders no badge — an empty pill is noise. */
  count?: number;
  /** Colour role of the badge. Defaults to "neutral". */
  variant?: BadgeVariant;
  /** Quiet second value on the label line, for context rather than pressure. */
  meta?: React.ReactNode;
}
export declare function BadgeHeader(props: BadgeHeaderProps): React.JSX.Element;

export interface AccordionSectionProps {
  /** Section name, printed in the 44px header row. */
  title: React.ReactNode;
  /** Quiet tally beside the title, e.g. "3 texts". */
  meta?: React.ReactNode;
  /** Badge count. 0 or omitted renders no badge. */
  badge?: number;
  /** Colour role of the badge. */
  badgeVariant?: BadgeVariant;
  /** Opens the section on first render. State is local and never persisted. */
  defaultExpanded?: boolean;
  /** The panel body. */
  children?: React.ReactNode;
}
export declare function AccordionSection(props: AccordionSectionProps): React.JSX.Element;

export interface ActionCardProps {
  /** What this card is about, e.g. a job name. */
  title: React.ReactNode;
  /** Right-aligned detail on the title line, e.g. "Evening / Night · Rank 1". */
  subtitle?: React.ReactNode;
  /** The verb on the button, e.g. "Work Shift". */
  actionLabel: React.ReactNode;
  /** Small print under the label while the action is available — its price. */
  hint?: React.ReactNode;
  onAction?: () => void;
  /** Greys the button and blocks the click. The card itself stays lit. */
  disabled?: boolean;
  /** Replaces `hint` while disabled. Always say why. */
  disabledReason?: React.ReactNode;
}
export declare function ActionCard(props: ActionCardProps): React.JSX.Element;

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
