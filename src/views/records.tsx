import React from 'react';
import type { PersonalRecord, Units, ViewProps } from '../types';
import { PALETTE } from '../theme';
import { EmptyState } from '../components';
import { usePersonalRecords } from '../hooks';
import { isWide } from '../size';
import { formatCount, formatDistance, formatElevation, formatRaceTime, formatShortDateYear } from '../format';

type RecordKind = 'time' | 'distance' | 'swimDistance' | 'ascent' | 'power' | 'count' | 'days';

interface RecordDef {
  label: string;
  group: string;
  kind: RecordKind;
  order: number;
}

/** The personalrecord service reports bare typeIds (no official mapping
 *  exists). This mapping is verified against captured real responses: the
 *  activity-linked ids (1–10, 17) carry the matching activity, and 12–16 are
 *  the activity-less Steps block (day/week/month, longest and current goal
 *  streak). Ids we could not confirm (11, 18+: strength-era records) are
 *  deliberately omitted — an unmapped record is hidden, never mislabeled. */
const RECORD_DEFS: Record<number, RecordDef> = {
  1: { label: '1K', group: 'Running', kind: 'time', order: 1 },
  2: { label: '1 mile', group: 'Running', kind: 'time', order: 2 },
  3: { label: '5K', group: 'Running', kind: 'time', order: 3 },
  4: { label: '10K', group: 'Running', kind: 'time', order: 4 },
  5: { label: 'Half marathon', group: 'Running', kind: 'time', order: 5 },
  6: { label: 'Marathon', group: 'Running', kind: 'time', order: 6 },
  7: { label: 'Longest run', group: 'Running', kind: 'distance', order: 7 },
  8: { label: 'Longest ride', group: 'Cycling', kind: 'distance', order: 8 },
  9: { label: 'Most ascent in a ride', group: 'Cycling', kind: 'ascent', order: 9 },
  10: { label: 'Max avg power (20 min)', group: 'Cycling', kind: 'power', order: 10 },
  17: { label: 'Longest swim', group: 'Swimming', kind: 'swimDistance', order: 11 },
  12: { label: 'Most steps in a day', group: 'Steps', kind: 'count', order: 12 },
  13: { label: 'Most steps in a week', group: 'Steps', kind: 'count', order: 13 },
  14: { label: 'Most steps in a month', group: 'Steps', kind: 'count', order: 14 },
  15: { label: 'Longest goal streak', group: 'Steps', kind: 'days', order: 15 },
  16: { label: 'Current goal streak', group: 'Steps', kind: 'days', order: 16 },
};

const GROUP_ORDER = ['Running', 'Cycling', 'Swimming', 'Steps'];

function formatRecord(value: number, kind: RecordKind, units: Units): string {
  switch (kind) {
    case 'time': return formatRaceTime(value);
    case 'distance': return formatDistance(value, units);
    // Pool distances read in yards/meters, never miles.
    case 'swimDistance': return units === 'imperial'
      ? `${formatCount(value * 1.09361)} yd`
      : `${formatCount(value)} m`;
    case 'ascent': return formatElevation(value, units);
    case 'power': return `${Math.round(value)} W`;
    case 'count': return formatCount(value);
    case 'days': return `${formatCount(value)} days`;
  }
}

interface Row {
  def: RecordDef;
  record: PersonalRecord;
}

/** Grouped best-efforts list (Running / Cycling / Swimming / Steps), each row
 *  a label, value, and the date it was set. Rows past the height budget are
 *  dropped from the bottom group up, with a "+N more" line, so short boxes
 *  show the headline runs instead of clipping. Wide-short boxes split the
 *  groups across two columns. */
export function RecordsView({ timezone, units, width, height, refreshMs }: ViewProps) {
  const load = usePersonalRecords(timezone, refreshMs);

  if (load.status === 'authExpired') {
    return (
      <EmptyState
        title="Reconnect Garmin"
        body="Your Garmin sign-in expired. Open the module settings and sign in again."
      />
    );
  }
  if (load.status === 'loading') {
    return <EmptyState title="Loading" body="Fetching your personal records..." />;
  }
  if (load.status === 'error') {
    return <EmptyState title="Can't reach Garmin" body="Could not load personal records." />;
  }

  const rows: Row[] = (load.data ?? [])
    .map((record) => ({ def: RECORD_DEFS[record.typeId], record }))
    .filter((r): r is Row => r.def != null)
    .sort((a, b) =>
      GROUP_ORDER.indexOf(a.def.group) - GROUP_ORDER.indexOf(b.def.group)
      || a.def.order - b.def.order);
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No records yet"
        body="Personal records appear as you run, ride, swim, and hit step goals with your watch."
      />
    );
  }

  const wide = isWide(width, height);
  const showDate = width >= 460;
  // Height budget: each row ~38, each group header ~30. Fill greedily in
  // group order and summarize the remainder.
  const ROW_H = 38, HEADER_H = 30, MORE_H = 24;
  const columns = wide ? 2 : 1;
  const budget = (height - 8) * columns;
  const groups = GROUP_ORDER
    .map((name) => ({ name, rows: rows.filter((r) => r.def.group === name) }))
    .filter((g) => g.rows.length > 0);

  let used = 0;
  let hidden = 0;
  const visible: { name: string; rows: Row[] }[] = [];
  for (const g of groups) {
    const remaining = budget - used - (hidden === 0 ? 0 : MORE_H);
    const fits = Math.max(0, Math.floor((remaining - HEADER_H) / ROW_H));
    const take = Math.min(g.rows.length, fits);
    if (take > 0) {
      visible.push({ name: g.name, rows: g.rows.slice(0, take) });
      used += HEADER_H + take * ROW_H;
    }
    hidden += g.rows.length - take;
  }

  // Rows breathe into leftover height (up to a cap) so tall boxes read as an
  // airy poster instead of a compressed table with a dead band below.
  const visibleRowCount = visible.reduce((s, g) => s + g.rows.length, 0);
  const spare = Math.max(0, budget - used - (hidden > 0 ? MORE_H : 0));
  const rowPadY = 7 + Math.min(16, Math.round(spare / Math.max(1, visibleRowCount * 2)));

  const groupBlock = (g: { name: string; rows: Row[] }) => (
    <div key={g.name} style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        fontSize: 12, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.5,
        padding: '8px 0 4px',
      }}>
        {g.name}
      </div>
      {g.rows.map(({ def, record }) => (
        <div key={record.typeId} style={{
          display: 'flex', alignItems: 'baseline', gap: 12, padding: `${rowPadY}px 0`,
          borderTop: `1px solid ${PALETTE.rail}`, fontSize: 15,
        }}>
          <span style={{ opacity: 0.8 }}>{def.label}</span>
          <span style={{
            marginLeft: 'auto', fontWeight: 700, fontSize: 17,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {formatRecord(record.value, def.kind, units)}
          </span>
          {showDate && (
            <span style={{ opacity: 0.5, fontSize: 13, width: 88, textAlign: 'right' }}>
              {formatShortDateYear(record.date) ?? ''}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  const more = hidden > 0 && (
    <div style={{ opacity: 0.5, fontSize: 12, paddingTop: 6 }}>+{hidden} more</div>
  );

  if (wide) {
    const half = Math.ceil(visible.length / 2);
    return (
      <div style={{ display: 'flex', height: '100%', gap: 56, justifyContent: 'center' }}>
        <div style={{ flex: 1, maxWidth: 480 }}>{visible.slice(0, half).map(groupBlock)}</div>
        <div style={{ flex: 1, maxWidth: 480 }}>
          {visible.slice(half).map(groupBlock)}
          {more}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
      {visible.map(groupBlock)}
      {more}
    </div>
  );
}
