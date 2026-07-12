import { describe, it, expect } from 'vitest';
import { tierFor, isWide } from '../size';

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

describe('isWide', () => {
  it('true for short, wide boxes', () => {
    expect(isWide(1200, 400)).toBe(true);
    expect(isWide(950, 500)).toBe(true);   // exactly 1.9×
  });
  it('false for the default card, near-square, or tall boxes', () => {
    expect(isWide(520, 640)).toBe(false);  // default card
    expect(isWide(620, 300)).toBe(false);  // wide ratio but too narrow overall
    expect(isWide(936, 620)).toBe(false);  // 1.5× — stacked fills this better
    expect(isWide(1000, 900)).toBe(false); // big but square-ish
  });
});
