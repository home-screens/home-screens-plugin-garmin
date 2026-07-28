// The host's module frame, implemented plugin-side.
//
// Why this file exists: the host does NOT wrap plugin modules in its
// `ModuleWrapper` the way it wraps built-in ones. A plugin renders its own
// root element, so every field of `ModuleStyle` — every slider in the
// editor's Style panel — only takes effect if the plugin implements it. A
// field you don't read is a control that silently does nothing for the user.
//
// Two of those fields are easy to get wrong, which is why this is a shared
// helper rather than an inline style object:
//
//   Border and shadow. `borderWidth` / `borderColor` / `shadowSize` were
//   added to the host after the first plugins shipped, so the obvious
//   hand-written root frame omits them.
//
//   Opacity under backdrop blur. Setting `opacity` on the element while
//   `backdrop-filter` is active makes the blur invisible: an opaque
//   background covers the blurred backdrop completely and Chrome renders
//   nothing. The host bakes the opacity into the background's alpha channel
//   instead; `hostFrameStyle` does the same.
//
// Use it for your root element and spread your own layout on top:
//
//   <div style={{ ...hostFrameStyle(style), display: 'flex', gap: '0.75em' }}>
//
// SIZING IS STILL YOURS. This file applies the host's font size to the root,
// which only reaches content authored in `em`/`rem` or derived from
// `style.fontSize`. Hard-coded pixel values ignore the Text size slider
// entirely — a module sized to fill a quarter of a 4K screen will still draw
// 12px labels. Author dimensions in `em` wherever you can.

import type { CSSProperties } from 'react';

/** The host's `ModuleStyle`, declared here rather than imported so this file
 *  is self-contained and can be copied between plugins verbatim. Structural
 *  typing means a plugin's own `ModuleStyle` satisfies it either way — and a
 *  plugin whose copy predates the last three fields still type-checks,
 *  because they're optional. */
export interface HostModuleStyle {
  fontSize: number;
  fontFamily: string;
  textColor: string;
  backgroundColor: string;
  borderRadius: number;
  padding: number;
  opacity: number;
  backdropBlur: number;
  borderWidth?: number;
  borderColor?: string;
  shadowSize?: number;
}

/** The host's default border color, matching its `ModuleWrapper`. */
const DEFAULT_BORDER_COLOR = 'rgba(255, 255, 255, 0.15)';

/** Parse `#rgb`, `#rrggbb`, `rgb()`, or `rgba()` into [r, g, b, a], with `a`
 *  defaulting to 1 for the forms that carry no alpha. Null for anything else,
 *  so callers can fall back rather than emit a broken color string.
 *
 *  Alpha is part of the return value rather than something a second regex
 *  digs out later: the two can only disagree, and when they do the module
 *  renders at the wrong opacity. Anything whose alpha this can't read must
 *  fail outright and go to the browser (see `resolveColor`) — succeeding
 *  while silently dropping an alpha is the one outcome callers can't detect. */
export function parseColor(input: string): [number, number, number, number] | null {
  const value = input.trim();

  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) {
    return [
      parseInt(short[1] + short[1], 16),
      parseInt(short[2] + short[2], 16),
      parseInt(short[3] + short[3], 16),
      1,
    ];
  }

  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (hex) {
    return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16), 1];
  }

  // Anchored at both ends, and both separator styles: `rgb(10, 20, 30)` and
  // the space form `rgb(0 0 0 / 50%)` the host's color picker also stores.
  // Percentage CHANNELS (`rgb(100% 0% 0%)`) deliberately don't match — they
  // fall through to the browser, which normalizes them for us.
  const fn = /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/i
    .exec(value);
  if (fn) {
    const rgb = [
      Math.round(Number(fn[1])), Math.round(Number(fn[2])), Math.round(Number(fn[3])),
    ];
    const alpha = fn[4] == null ? 1 : Number(fn[4]) / (fn[5] ? 100 : 1);
    if (rgb.every((c) => Number.isFinite(c) && c >= 0 && c <= 255)
      && Number.isFinite(alpha) && alpha >= 0 && alpha <= 1) {
      return [rgb[0], rgb[1], rgb[2], alpha];
    }
  }

  return null;
}

/** One DOM probe per distinct string — the host re-renders the module on
 *  every tick and the answer never changes. */
const resolved = new Map<string, string | null>();

/** The same color in a form `parseColor` can read, or null if it isn't a
 *  color at all.
 *
 *  The host's color picker accepts anything the browser calls valid and
 *  stores the string verbatim, so `black`, `hsl(0 0% 10%)`, `#000000cc`, and
 *  `rgb(0 0 0 / 50%)` all reach plugin code. Anything the regexes above
 *  can't read goes to the browser, which is the only thing that knows what
 *  `rebeccapurple` is. Outside a DOM (unit tests) there is nothing to ask
 *  and the caller falls back. */
export function resolveColor(input: string): string | null {
  if (parseColor(input)) return input;

  const cached = resolved.get(input);
  if (cached !== undefined) return cached;

  let out: string | null = null;
  if (typeof document !== 'undefined' && document.body) {
    const probe = document.createElement('div');
    probe.style.color = input;
    // An invalid value leaves the property untouched; without this check the
    // computed style below would hand back the inherited color and turn
    // gibberish into whatever the page happens to be using.
    if (probe.style.color !== '') {
      // A detached element has no computed style, so the probe has to be in
      // the document. `display: none` keeps it out of layout.
      probe.style.display = 'none';
      document.body.appendChild(probe);
      try {
        const computed = getComputedStyle(probe).color;
        out = parseColor(computed) ? computed : null;
      } finally {
        probe.remove();
      }
    }
  }
  resolved.set(input, out);
  return out;
}

/** Bake an alpha into a color so a blurred module can carry its opacity in
 *  the background rather than on the element. Null when the color can't be
 *  read at all, so the caller can fall back to element opacity — a slightly
 *  weaker blur beats an opacity setting that does nothing. */
export function colorWithAlpha(color: string, alpha: number): string | null {
  if (alpha >= 1) return color;
  const resolvedColor = resolveColor(color);
  const rgba = resolvedColor ? parseColor(resolvedColor) : null;
  if (!rgba) return null;
  // A background that is already translucent keeps its own alpha, scaled, so
  // a default like rgba(0, 0, 0, 0.35) doesn't jump to opaque.
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3] * alpha})`;
}

/** The host's module shadow, matched to what its `buildModuleShadow` gives
 *  every built-in: a hairline top highlight, a cast shadow, and a faint
 *  ambient ring. Reimplemented rather than imported — plugins can't reach
 *  into host modules. */
export function moduleShadow(size: number): string | undefined {
  if (size <= 0) return undefined;
  const offset = Math.round(size / 2);
  const ambient = Math.round(size / 2);
  return 'inset 0 1px 0 rgba(255, 255, 255, 0.12), '
    + `0 ${offset}px ${size}px rgba(0, 0, 0, 0.8), `
    + `0 0 ${ambient}px rgba(255, 255, 255, 0.04)`;
}

/** The font size a plugin's pixel dimensions are authored against, when it
 *  doesn't say otherwise. Matches the host's own `DEFAULT_MODULE_STYLE`. */
export const DEFAULT_BASE_FONT_SIZE = 16;

export interface HostFrameOptions {
  /** Draw no surface of our own — no background, border, shadow, or blur —
   *  while still taking type and color from the host. For modules that float
   *  their own tiles over the screen instead of filling a card. */
  chromeless?: boolean;
  /** The font size this plugin's pixel dimensions were authored against —
   *  its manifest `defaultStyle.fontSize`. Sets the `--u` scale variable (see
   *  `scalePx`). Defaults to the host's own default. */
  baseFontSize?: number;
}

/** Scale an authored pixel dimension by the host's Text size.
 *
 *  The host's Text size reaches the root as a font size, so `em` values
 *  follow it and pixel values do not. `em` isn't always usable though: it
 *  resolves against the element's OWN font size, so two elements with
 *  different type but a shared width (a table cell and its column header)
 *  would end up different widths. `--u` is published once on the root by
 *  `hostFrameStyle`, so every `calc(Npx * var(--u))` lands on the same
 *  number wherever it sits — and it works inside plain constant style
 *  objects, which a React hook cannot.
 *
 *  Falls back to 1 so styles still resolve outside a host frame. */
export function scalePx(n: number): string {
  return `calc(${n}px * var(--u, 1))`;
}

/** Every `ModuleStyle` field, applied the way the host applies it to
 *  built-in modules. Spread onto your root element, then add your layout. */
export function hostFrameStyle(
  style: HostModuleStyle,
  options: HostFrameOptions = {},
): CSSProperties {
  const chromeless = options.chromeless ?? false;
  const base = options.baseFontSize ?? DEFAULT_BASE_FONT_SIZE;
  // Guard the zero/NaN case: a bad font size would otherwise multiply every
  // scaled dimension by zero and render the module as a sliver.
  const fontSize = Number.isFinite(style.fontSize) && style.fontSize > 0
    ? style.fontSize
    : base;
  const blur = chromeless ? 0 : style.backdropBlur ?? 0;
  const hasBlur = blur > 0;
  const borderWidth = chromeless ? 0 : style.borderWidth ?? 0;
  const shadowSize = chromeless ? 0 : style.shadowSize ?? 0;
  // See the header note: with blur on, the opacity has to live in the
  // background's alpha or the blur renders invisible.
  const bakedBackground = hasBlur
    ? colorWithAlpha(style.backgroundColor, style.opacity)
    : null;

  return {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box',
    // Published for `scalePx`, so pixel dimensions can follow the Text size
    // slider the same way `em` type does.
    ['--u' as string]: fontSize / base,
    fontFamily: style.fontFamily,
    fontSize,
    color: style.textColor,
    backgroundColor: chromeless
      ? 'transparent'
      : bakedBackground ?? style.backgroundColor,
    opacity: bakedBackground ? undefined : style.opacity,
    borderRadius: style.borderRadius,
    padding: style.padding,
    border: borderWidth > 0
      ? `${borderWidth}px solid ${style.borderColor ?? DEFAULT_BORDER_COLOR}`
      : undefined,
    boxShadow: moduleShadow(shadowSize),
    backdropFilter: hasBlur ? `blur(${blur}px)` : undefined,
    WebkitBackdropFilter: hasBlur ? `blur(${blur}px)` : undefined,
  };
}
