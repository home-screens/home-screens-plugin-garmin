import React from 'react';
import type { ViewProps } from '../types';
import { PALETTE } from '../theme';
import { Gauge, StatTile } from '../components';
import { BatteryStressChart } from '../charts';
import { stackGap } from '../size';

/** Gauge + charged/drained always; the Body Battery + stress chart (with its
 *  legend) appears whenever the measured height fits it, and the gauge
 *  absorbs the leftover height. A failed dailyStress fetch leaves stressCurve
 *  empty — the chart then draws battery alone. */
export function BodyBatteryView({ data, width, height }: ViewProps) {
  const gap = stackGap(height);
  // Height budget: tiles ~50, chart label 18 + legend ~22, two stack gaps.
  const chartH = Math.round(Math.max(90, Math.min(320, height * 0.34)));
  const chartBlockH = chartH + 18 + 22 + gap;
  const showChart = data.bodyBatteryCurve.length >= 2
    && height - (97 + 50 + gap) >= chartBlockH; // 97 = minimum gauge height
  const gaugeAvail = height - 50 - gap - 12 - (showChart ? chartBlockH : 0);
  const gaugeSize = Math.round(Math.max(170, Math.min(
    Math.min(340, width - 20),
    (gaugeAvail - 12) * 2,
  )));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', gap,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Gauge value={data.bodyBattery ?? 0} size={gaugeSize} color={PALETTE.bodyBattery} />
      <div style={{ display: 'flex', gap: 28 }}>
        <StatTile label="Charged" value={data.bodyBatteryCharged != null ? `+${data.bodyBatteryCharged}` : '--'} color={PALETTE.bodyBattery} />
        <StatTile label="Drained" value={data.bodyBatteryDrained != null ? `-${data.bodyBatteryDrained}` : '--'} color={PALETTE.stress} />
      </div>
      {showChart && (
        <div style={{ width: '100%' }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Today</div>
          <BatteryStressChart
            battery={data.bodyBatteryCurve} stress={data.stressCurve}
            width={width} height={chartH}
          />
        </div>
      )}
    </div>
  );
}
