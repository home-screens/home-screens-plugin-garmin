// Module-wide sizing. Every dimension on the display surface — type, gaps,
// padding, stroke widths, and the height-budget constants the views lay
// themselves out with — is authored at the size it should be when the host's
// "Text size" style sits at this plugin's default, then run through the scale
// this module provides.
//
// Why this exists: the host scales a module by handing it style.fontSize (the
// Text size slider, 8–72) and expecting the module's contents to follow.
// Built-in modules get that for free by expressing everything in `em` off the
// module root. This plugin can't: its views budget their layout in pixels
// against the measured box (`TILE_ROW`, `MIN_RING`, `SLACK` in summary.tsx
// and its siblings), and its charts hand numeric width/height/strokeWidth
// straight to SVG attributes. `em` is not a number and does not work in
// either place. A single numeric factor applied at each call site does, and
// it keeps the budget arithmetic internally consistent — if the type grows,
// the row heights budgeted for that type grow with it.
//
// A display at 4K is the case that made this necessary: the user sizes the
// module to fill a quarter of a 3840×2160 screen, and without this every
// label stays the size it was on a 1080p canvas.
//
// Note the division of labor with size.ts: that file adapts to the module's
// measured BOX (tiers, wide/narrow, vertical rhythm). This one adapts to the
// user's TEXT SIZE. They are independent axes and both apply.

import React from 'react';

/** The font size this plugin's dimensions are authored against. The manifest
 *  sets no `defaultStyle.fontSize`, so this is the host's own default
 *  (`DEFAULT_MODULE_STYLE.fontSize`). At this setting the scale factor is
 *  exactly 1 and every view renders pixel-for-pixel as it always has. */
export const BASE_FONT_SIZE = 16;

export interface Scale {
  /** Scale an authored pixel dimension. */
  (px: number): number;
  /** The raw multiplier, for the rare call site that needs it. */
  factor: number;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function makeScale(fontSize: number): Scale {
  // A missing or nonsensical style.fontSize must not collapse the module.
  const safe = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : BASE_FONT_SIZE;
  const factor = safe / BASE_FONT_SIZE;
  const scale = ((px: number) => round(px * factor)) as Scale;
  scale.factor = factor;
  return scale;
}

/** Clamp `value` into [min, max] with the CAP applied last, so it wins when a
 *  scaled minimum has grown past it.
 *
 *  `Math.max(min, Math.min(max, v))` — the shape these views were originally
 *  written with — gets this backwards. It was harmless while both bounds were
 *  pixel literals and the minimum was chosen to sit well below any realistic
 *  box. Once the minimum scales with the host's Text size and the maximum is
 *  derived from the measured box (which does not scale), the floor overtakes
 *  the cap and the result overflows the very box the cap was guarding. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Identity scale. Used as the context default so anything rendered outside a
 *  provider — tests, and the config panel's own preview — keeps its authored
 *  sizes. */
export const UNSCALED = makeScale(BASE_FONT_SIZE);

const ScaleContext = React.createContext<Scale>(UNSCALED);

export function ScaleProvider({ fontSize, children }: {
  fontSize: number; children: React.ReactNode;
}) {
  const scale = React.useMemo(() => makeScale(fontSize), [fontSize]);
  return <ScaleContext.Provider value={scale}>{children}</ScaleContext.Provider>;
}

export function useScale(): Scale {
  return React.useContext(ScaleContext);
}
