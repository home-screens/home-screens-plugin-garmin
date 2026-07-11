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
