import React from 'react';
import type { ViewProps } from '../types';
import { PALETTE } from '../theme';
import { Gauge, Sparkline, StatTile } from '../components';
import { BatteryStressChart } from '../charts';

/** compact: v1 (gauge + charged/drained + plain sparkline). medium+: the
 *  sparkline becomes the dual Body Battery + stress chart. A failed dailyStress
 *  fetch leaves stressCurve empty — the dual chart then draws battery alone,
 *  matching v1's appearance. */
export function BodyBatteryView({ data, tier, width }: ViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16, alignItems: 'center' }}>
      <Gauge value={data.bodyBattery ?? 0} size={tier === 'large' ? 260 : 220} color={PALETTE.bodyBattery} />
      <div style={{ display: 'flex', gap: 28 }}>
        <StatTile label="Charged" value={data.bodyBatteryCharged != null ? `+${data.bodyBatteryCharged}` : '--'} color={PALETTE.bodyBattery} />
        <StatTile label="Drained" value={data.bodyBatteryDrained != null ? `-${data.bodyBatteryDrained}` : '--'} color={PALETTE.stress} />
      </div>
      <div style={{ width: '100%', marginTop: 'auto' }}>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Today</div>
        {tier === 'compact' ? (
          <Sparkline points={data.bodyBatteryCurve} width={width} height={90} color={PALETTE.bodyBattery} />
        ) : (
          <BatteryStressChart
            battery={data.bodyBatteryCurve} stress={data.stressCurve}
            width={width} height={tier === 'large' ? 150 : 110}
          />
        )}
      </div>
    </div>
  );
}
