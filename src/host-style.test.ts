// Guards the module frame contract. Every assertion here corresponds to a
// slider in the host's Style panel that this plugin used to ignore.

import { describe, it, expect } from 'vitest';
import {
  hostFrameStyle, colorWithAlpha, moduleShadow, parseColor, scalePx,
} from './host-style';
import type { HostModuleStyle } from './host-style';

const BASE: HostModuleStyle = {
  fontSize: 16,
  fontFamily: 'Inter',
  textColor: '#ffffff',
  backgroundColor: '#000000',
  borderRadius: 12,
  padding: 16,
  opacity: 1,
  backdropBlur: 0,
};

describe('hostFrameStyle', () => {
  it('carries the plain style fields through to the root', () => {
    const s = hostFrameStyle(BASE);
    expect(s.fontSize).toBe(16);
    expect(s.fontFamily).toBe('Inter');
    expect(s.color).toBe('#ffffff');
    expect(s.borderRadius).toBe(12);
    expect(s.padding).toBe(16);
    expect(s.backgroundColor).toBe('#000000');
  });

  it('draws a border only once borderWidth is above zero', () => {
    expect(hostFrameStyle(BASE).border).toBeUndefined();
    expect(hostFrameStyle({ ...BASE, borderWidth: 0 }).border).toBeUndefined();
    expect(hostFrameStyle({ ...BASE, borderWidth: 2 }).border)
      .toBe('2px solid rgba(255, 255, 255, 0.15)');
  });

  it('uses the configured border color when one is set', () => {
    expect(hostFrameStyle({ ...BASE, borderWidth: 1, borderColor: '#ff0000' }).border)
      .toBe('1px solid #ff0000');
  });

  it('draws a shadow only once shadowSize is above zero', () => {
    expect(hostFrameStyle(BASE).boxShadow).toBeUndefined();
    expect(hostFrameStyle({ ...BASE, shadowSize: 24 }).boxShadow)
      .toContain('0 12px 24px rgba(0, 0, 0, 0.8)');
  });

  // The interaction that made this a shared helper: opacity on the element
  // hides the blur entirely, so it has to move into the background's alpha.
  describe('opacity under backdrop blur', () => {
    it('stays on the element when there is no blur', () => {
      const s = hostFrameStyle({ ...BASE, opacity: 0.5 });
      expect(s.opacity).toBe(0.5);
      expect(s.backgroundColor).toBe('#000000');
      expect(s.backdropFilter).toBeUndefined();
    });

    it('bakes into the background alpha when blur is on', () => {
      const s = hostFrameStyle({ ...BASE, opacity: 0.5, backdropBlur: 8 });
      expect(s.opacity).toBeUndefined();
      expect(s.backgroundColor).toBe('rgba(0, 0, 0, 0.5)');
      expect(s.backdropFilter).toBe('blur(8px)');
      expect(s.WebkitBackdropFilter).toBe('blur(8px)');
    });

    it('scales an already-translucent background rather than making it opaque', () => {
      const s = hostFrameStyle({
        ...BASE, backgroundColor: 'rgba(0, 0, 0, 0.4)', opacity: 0.5, backdropBlur: 8,
      });
      expect(s.backgroundColor).toBe('rgba(0, 0, 0, 0.2)');
    });

    it('falls back to element opacity when the background cannot be read', () => {
      // No DOM to probe in this environment, so an unparseable color has no
      // alpha to bake into — a weaker blur beats a dead opacity slider.
      const s = hostFrameStyle({
        ...BASE, backgroundColor: 'not-a-color', opacity: 0.5, backdropBlur: 8,
      });
      expect(s.opacity).toBe(0.5);
      expect(s.backgroundColor).toBe('not-a-color');
    });
  });

  // The scale variable behind `scalePx`, for pixel dimensions that can't be
  // `em` — column widths shared across two type sizes, or values living in a
  // plain constant style object where no hook can reach.
  describe('the --u scale variable', () => {
    const u = (s: HostModuleStyle, opts?: { baseFontSize?: number }) =>
      (hostFrameStyle(s, opts) as Record<string, unknown>)['--u'];

    it('is 1 at the authored size, so the shipped look is unchanged', () => {
      expect(u({ ...BASE, fontSize: 16 })).toBe(1);
    });

    it('tracks the host Text size', () => {
      expect(u({ ...BASE, fontSize: 32 })).toBe(2);
      expect(u({ ...BASE, fontSize: 8 })).toBe(0.5);
    });

    it('measures against the plugin authored base when one is given', () => {
      expect(u({ ...BASE, fontSize: 14 }, { baseFontSize: 14 })).toBe(1);
      expect(u({ ...BASE, fontSize: 28 }, { baseFontSize: 14 })).toBe(2);
    });

    it('falls back to 1 rather than collapsing every scaled dimension', () => {
      expect(u({ ...BASE, fontSize: 0 })).toBe(1);
      expect(u({ ...BASE, fontSize: Number.NaN })).toBe(1);
      expect(u({ ...BASE, fontSize: -8 })).toBe(1);
      expect(u({ ...BASE, fontSize: undefined as unknown as number })).toBe(1);
    });

    it('also repairs the root font size, not just the variable', () => {
      expect(hostFrameStyle({ ...BASE, fontSize: 0 }).fontSize).toBe(16);
    });
  });

  describe('scalePx', () => {
    it('emits a calc against the variable, defaulting to unscaled', () => {
      expect(scalePx(18)).toBe('calc(18px * var(--u, 1))');
    });
  });

  it('drops its own surface when chromeless', () => {
    const s = hostFrameStyle(
      { ...BASE, borderWidth: 2, shadowSize: 10, backdropBlur: 6 },
      { chromeless: true },
    );
    expect(s.backgroundColor).toBe('transparent');
    expect(s.border).toBeUndefined();
    expect(s.boxShadow).toBeUndefined();
    expect(s.backdropFilter).toBeUndefined();
    // Type and color still come from the host.
    expect(s.fontSize).toBe(16);
    expect(s.color).toBe('#ffffff');
  });
});

describe('parseColor', () => {
  it('reads the forms the host stores', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1]);
    expect(parseColor('#1e3a5f')).toEqual([30, 58, 95, 1]);
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30, 1]);
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30, 0.5]);
  });

  it('reads the space-separated form the color picker also stores', () => {
    // Succeeding here while dropping the alpha is the dangerous failure: the
    // caller has no way to tell, and renders at twice the intended opacity.
    expect(parseColor('rgb(0 0 0 / 50%)')).toEqual([0, 0, 0, 0.5]);
    expect(parseColor('rgb(10 20 30)')).toEqual([10, 20, 30, 1]);
    expect(parseColor('rgba(10 20 30 / 0.25)')).toEqual([10, 20, 30, 0.25]);
  });

  it('returns null rather than guessing', () => {
    expect(parseColor('rebeccapurple')).toBeNull();
    expect(parseColor('')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
    // Percentage channels are left to the browser rather than half-read.
    expect(parseColor('rgb(100% 0% 0%)')).toBeNull();
    // Trailing junk must not be ignored by an unanchored match.
    expect(parseColor('rgb(10, 20, 30) drop shadow')).toBeNull();
  });
});

describe('colorWithAlpha', () => {
  it('is a no-op at full opacity', () => {
    expect(colorWithAlpha('#abcdef', 1)).toBe('#abcdef');
  });

  it('multiplies into an alpha the color already carries', () => {
    expect(colorWithAlpha('rgba(0, 0, 0, 0.5)', 0.5)).toBe('rgba(0, 0, 0, 0.25)');
    expect(colorWithAlpha('rgb(0 0 0 / 50%)', 0.5)).toBe('rgba(0, 0, 0, 0.25)');
  });

  it('returns null for a color it cannot read, so callers can fall back', () => {
    expect(colorWithAlpha('not-a-color', 0.5)).toBeNull();
  });
});

describe('moduleShadow', () => {
  it('is absent at zero and below', () => {
    expect(moduleShadow(0)).toBeUndefined();
    expect(moduleShadow(-1)).toBeUndefined();
  });

  it('matches the host shape: highlight, cast shadow, ambient ring', () => {
    const shadow = moduleShadow(16) ?? '';
    expect(shadow).toContain('inset 0 1px 0 rgba(255, 255, 255, 0.12)');
    expect(shadow).toContain('0 8px 16px rgba(0, 0, 0, 0.8)');
    expect(shadow).toContain('0 0 8px rgba(255, 255, 255, 0.04)');
  });
});
