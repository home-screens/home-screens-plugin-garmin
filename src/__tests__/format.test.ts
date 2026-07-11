import { describe, it, expect } from 'vitest';
import {
  formatDuration, formatDistance, formatCount, activityLabel,
  formatPace, formatSpeed, formatSwimPace, formatElevation, formatMinSec,
} from '../format';

describe('formatDuration', () => {
  it('formats hours and minutes', () => expect(formatDuration(27120)).toBe('7h 32m'));
  it('formats minutes only', () => expect(formatDuration(1500)).toBe('25m'));
  it('handles null/zero', () => { expect(formatDuration(null)).toBe('0m'); expect(formatDuration(0)).toBe('0m'); });
  it('carries a rounded-up remainder into the hours (never :60)', () => {
    expect(formatDuration(7190)).toBe('2h 0m');
    expect(formatDuration(28776)).toBe('8h 0m');
    expect(formatDuration(7190)).not.toContain('60m');
    expect(formatDuration(28776)).not.toContain('60m');
  });
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

describe('formatPace', () => {
  it('metric min/km', () => expect(formatPace(3.2, 'metric')).toBe('5:13 /km'));      // 1000/3.2 = 312.5s → 313
  it('imperial min/mi', () => expect(formatPace(3.2, 'imperial')).toBe('8:23 /mi'));  // 1609.344/3.2 ≈ 503s
  it('pads sub-10 seconds', () => expect(formatPace(1000 / 305, 'metric')).toBe('5:05 /km'));
  it('rounds without a :60 artifact', () => expect(formatPace(1000 / 299.6, 'metric')).toBe('5:00 /km'));
  it('null and zero → --', () => {
    expect(formatPace(null, 'metric')).toBe('--');
    expect(formatPace(0, 'metric')).toBe('--');
  });
});

describe('formatSpeed', () => {
  it('metric km/h', () => expect(formatSpeed(6.7, 'metric')).toBe('24.1 km/h'));
  it('imperial mph', () => expect(formatSpeed(6.7, 'imperial')).toBe('15.0 mph'));
  it('null → --', () => expect(formatSpeed(null, 'metric')).toBe('--'));
});

describe('formatSwimPace', () => {
  it('metric per 100m', () => expect(formatSwimPace(0.95, 'metric')).toBe('1:45 /100m'));
  it('imperial per 100yd', () => expect(formatSwimPace(0.95, 'imperial')).toBe('1:36 /100yd')); // 91.44/0.95 ≈ 96s
  it('null → --', () => expect(formatSwimPace(null, 'metric')).toBe('--'));
});

describe('formatElevation', () => {
  it('metric meters', () => expect(formatElevation(320.4, 'metric')).toBe('320 m'));
  it('imperial feet with grouping', () => expect(formatElevation(320.4, 'imperial')).toBe('1,051 ft'));
  it('null → --', () => expect(formatElevation(null, 'metric')).toBe('--'));
});

describe('formatMinSec', () => {
  it('m:ss', () => expect(formatMinSec(292)).toBe('4:52'));
  it('rounds fractional seconds', () => expect(formatMinSec(292.6)).toBe('4:53'));
  it('null/zero → --', () => { expect(formatMinSec(null)).toBe('--'); expect(formatMinSec(0)).toBe('--'); });
});
