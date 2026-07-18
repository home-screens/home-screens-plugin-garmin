import { describe, it, expect } from 'vitest';
import { selectPublishableKeys, planClears, planHealthReport } from '../StateProvider';

describe('selectPublishableKeys', () => {
  it('keeps known Garmin keys and drops everything else', () => {
    expect(selectPublishableKeys([
      'body_battery', 'sleep_score', 'steps', 'typo_key', 'plugin:other:thing',
    ])).toEqual(['body_battery', 'sleep_score', 'steps']);
  });

  it('returns an empty array when nothing demanded matches', () => {
    expect(selectPublishableKeys(['not_a_garmin_key'])).toEqual([]);
  });
});

describe('planClears', () => {
  it('clears published keys that dropped out of the demand set', () => {
    const published = new Set(['body_battery', 'sleep_score', 'steps']);
    expect(planClears(published, ['body_battery'])).toEqual(['sleep_score', 'steps']);
  });

  it('clears everything when the demand set is empty (disconnect / auth-expired)', () => {
    const published = new Set(['body_battery', 'steps']);
    expect(planClears(published, [])).toEqual(['body_battery', 'steps']);
  });

  it('clears nothing when every published key is still demanded', () => {
    const published = new Set(['steps']);
    expect(planClears(published, ['steps', 'body_battery'])).toEqual([]);
  });
});

describe('planHealthReport', () => {
  it('opens an outage and reports not-ok on the first failure', () => {
    const { report, outage } = planHealthReport(null, { ok: false, message: "Can't reach Garmin", at: 1000 });
    expect(report).toEqual({ ok: false, message: "Can't reach Garmin", since: 1000 });
    expect(outage).toEqual({ since: 1000 });
  });

  it('stays silent on a repeated failure, keeping the original since', () => {
    const prevOutage = { since: 1000 };
    const { report, outage } = planHealthReport(prevOutage, { ok: false, message: 'still down', at: 2000 });
    expect(report).toBeNull();
    expect(outage).toEqual({ since: 1000 });
  });

  it('reports ok once on recovery and closes the outage', () => {
    const prevOutage = { since: 1000 };
    const { report, outage } = planHealthReport(prevOutage, { ok: true });
    expect(report).toEqual({ ok: true });
    expect(outage).toBeNull();
  });

  it('stays silent while already healthy', () => {
    const { report, outage } = planHealthReport(null, { ok: true });
    expect(report).toBeNull();
    expect(outage).toBeNull();
  });
});
