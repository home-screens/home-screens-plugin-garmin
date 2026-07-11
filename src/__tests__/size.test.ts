import { describe, it, expect } from 'vitest';
import { tierFor } from '../size';

describe('tierFor', () => {
  it('compact below 500px tall', () => {
    expect(tierFor(520, 499)).toBe('compact');
    expect(tierFor(1040, 300)).toBe('compact');
  });
  it('medium 500–899', () => {
    expect(tierFor(520, 500)).toBe('medium');
    expect(tierFor(520, 640)).toBe('medium'); // the default card
    expect(tierFor(520, 899)).toBe('medium');
  });
  it('large at 900+', () => {
    expect(tierFor(1040, 900)).toBe('large');
    expect(tierFor(1040, 1100)).toBe('large');
  });
});
