import { useMemo, useState } from 'react';
import type { Dataset } from '../../types/data';
import { benchmarkPath, EU, series } from '../../lib/indicators';
import { fmtInt, fmtRate } from '../../lib/format';
import { SeriesChart, type Benchmark } from './SeriesChart';

type Mode = 'count' | 'rate';

export function EuTrend({ data }: { data: Dataset }) {
  const [mode, setMode] = useState<Mode>('count');
  const counts = useMemo(() => series(data.observations, EU, 'road_fatalities'), [data]);
  const rates = useMemo(() => series(data.observations, EU, 'road_fatalities_per_million'), [data]);
  const target = data.metadata.targets.find((t) => t.geo === EU && t.indicator === 'road_fatalities') ?? null;
  const benchmark: Benchmark | null = target && target.target_value != null
    ? { baselinePeriod: target.baseline_period, targetPeriod: target.target_period, targetValue: target.target_value, path: benchmarkPath(target) }
    : null;
  const ratesAvailable = rates.some((p) => p.value != null) && counts.some((p) => p.value != null);

  return (
    <section className="panel" aria-labelledby="eu-trend-heading">
      <div className="panel__head">
        <h2 id="eu-trend-heading">EU road fatalities over time</h2>
        {ratesAvailable && (
          <div className="segmented" role="group" aria-label="Measure">
            <button type="button" aria-pressed={mode === 'count'} onClick={() => setMode('count')}>Deaths</button>
            <button type="button" aria-pressed={mode === 'rate'} onClick={() => setMode('rate')}>Per million inhabitants</button>
          </div>
        )}
      </div>
      {mode === 'count' ? (
        <SeriesChart
          title={`Road deaths, European Union (27), ${counts[0]?.period ?? ''}–${counts.filter((p) => p.value != null).at(-1)?.period ?? ''}`}
          subject="EU road deaths"
          points={counts}
          unitLabel="deaths"
          format={fmtInt}
          baselinePeriod={target?.baseline_period}
          benchmark={benchmark}
        />
      ) : (
        <SeriesChart
          title="Road deaths per million inhabitants, European Union (27)"
          subject="EU road deaths per million inhabitants"
          points={rates}
          unitLabel="per million"
          format={fmtRate}
          baselinePeriod={target?.baseline_period}
        />
      )}
      <p className="small"><a href="#/charts">Build your own chart for the EU total and any Member State →</a></p>
      {mode === 'rate' && (
        <p className="muted small">The 2030 benchmark is defined for the number of deaths, so it is shown only in the "Deaths" view.</p>
      )}
    </section>
  );
}
