import { describe, it, expect } from 'vitest';
import { formatDuration, formatDistance, formatCount, activityLabel } from '../format';

describe('formatDuration', () => {
  it('formats hours and minutes', () => expect(formatDuration(27120)).toBe('7h 32m'));
  it('formats minutes only', () => expect(formatDuration(1500)).toBe('25m'));
  it('handles null/zero', () => { expect(formatDuration(null)).toBe('0m'); expect(formatDuration(0)).toBe('0m'); });
});

describe('formatDistance', () => {
  it('metric km', () => expect(formatDistance(5200, 'metric')).toBe('5.20 km'));
  it('imperial mi', () => expect(formatDistance(5200, 'imperial')).toBe('3.23 mi'));
  it('drops a decimal past 10', () => expect(formatDistance(21097, 'metric')).toBe('21.1 km'));
});

describe('formatCount', () => {
  it('groups thousands', () => expect(formatCount(8421)).toBe('8,421'));
  it('renders -- for null', () => expect(formatCount(null)).toBe('--'));
});

describe('activityLabel', () => {
  it('maps known keys', () => expect(activityLabel('trail_running')).toBe('Trail run'));
  it('title-cases unknown keys', () => expect(activityLabel('foo_bar')).toBe('Foo Bar'));
});
