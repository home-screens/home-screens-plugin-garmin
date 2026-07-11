/** Brand-neutral palette, readable on both light and dark module backgrounds. */
export const PALETTE = {
  steps: '#3b82f6',
  bodyBattery: '#22c55e',
  stress: '#f59e0b',
  heart: '#ef4444',
  sleepDeep: '#4338ca',
  sleepLight: '#6366f1',
  sleepRem: '#a855f7',
  awake: '#64748b',
  rail: 'rgba(148,163,184,0.25)',
  // HR zones (spec-fixed)
  z1: '#64748b',
  z2: '#3b82f6',
  z3: '#22c55e',
  z4: '#f59e0b',
  z5: '#ef4444',
  // One accent per sport — 6-digit hex only (SportBadge appends alpha as "26")
  sports: {
    running: '#3b82f6',
    cycling: '#22c55e',
    swimming: '#06b6d4',
    walking: '#a855f7',
    hiking: '#f59e0b',
    strength: '#ef4444',
    other: '#64748b',
  },
} as const;
