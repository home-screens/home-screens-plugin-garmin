import React from 'react';
import type { ViewProps } from '../types';
import { PALETTE } from '../theme';
import { Gauge, StatTile } from '../components';
import { BatteryStressChart } from '../charts';
import { stackGap } from '../size';
import { clamp, useScale } from '../scale';

/** Gauge + charged/drained always; the Body Battery + stress chart (with its
 *  legend) appears whenever the measured height fits it, and the gauge
 *  absorbs the leftover height. A failed dailyStress fetch leaves stressCurve
 *  empty — the chart then draws battery alone. */
export function BodyBatteryView({ data, width, height }: ViewProps) {
  const u = useScale();
  const gap = stackGap(height);
  // Height budget: tiles ~50, chart label 18 + legend ~22, two stack gaps.
  const chartH = Math.round(Math.max(u(90), Math.min(u(320), height * 0.34)));
  const chartBlockH = chartH + u(18) + u(22) + gap;
  const showChart = data.bodyBatteryCurve.length >= 2
    && height - (u(97) + u(50) + gap) >= chartBlockH; // u(97) = minimum gauge height
  const gaugeAvail = height - u(50) - gap - u(12) - (showChart ? chartBlockH : 0);
  // The width cap is a hard one — the root clips — so it is applied last and
  // beats the minimum. A scaled floor of u(170) is wider than a small module
  // by Text size 32.
  const gaugeSize = Math.round(clamp(
    (gaugeAvail - u(12)) * 2,
    u(170),
    Math.min(u(340), width - u(20)),
  ));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', gap,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Gauge value={data.bodyBattery ?? 0} size={gaugeSize} color={PALETTE.bodyBattery} />
      <div style={{ display: 'flex', gap: u(28) }}>
        <StatTile label="Charged" value={data.bodyBatteryCharged != null ? `+${data.bodyBatteryCharged}` : '--'} color={PALETTE.bodyBattery} />
        <StatTile label="Drained" value={data.bodyBatteryDrained != null ? `-${data.bodyBatteryDrained}` : '--'} color={PALETTE.stress} />
      </div>
      {showChart && (
        <div style={{ width: '100%' }}>
          <div style={{ fontSize: u(12), opacity: 0.6, marginBottom: u(6) }}>Today</div>
          <BatteryStressChart
            battery={data.bodyBatteryCurve} stress={data.stressCurve}
            width={width} height={chartH}
          />
        </div>
      )}
    </div>
  );
}
