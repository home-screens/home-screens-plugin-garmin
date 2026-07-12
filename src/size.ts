import type { SizeTier } from './types';

/** Bucket a measured module box into a discrete layout tier (spec-fixed
 *  boundaries). Width is passed for future density decisions but tiering is
 *  height-driven. */
export function tierFor(width: number, height: number): SizeTier {
  void width;
  if (height < 500) return 'compact';
  if (height < 900) return 'medium';
  return 'large';
}

/** A short, wide box reads better as two side-by-side panes (hero left,
 *  stats right) than as a vertical stack with stretched rows. */
export function isWide(width: number, height: number): boolean {
  return width >= 640 && width >= height * 1.9;
}

/** Vertical rhythm scaled to the box height: tight in small modules, airy in
 *  tall ones, so small modules pack instead of clipping. */
export function stackGap(height: number): number {
  return Math.max(16, Math.min(36, Math.round(height * 0.055)));
}
