import type { ReactNode } from 'react';
import type { Dataset, Status } from '../../types/data';
import { benchmarkPath, computeEuKpis } from '../../lib/indicators';
import { fmtInt, fmtPct, fmtRate, NOT_AVAILABLE } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';

function Card({ label, value, period, status, children }: {
  label: string; value: string; period: string; status: Status; children?: ReactNode;
}) {
  return (
    <article className="kpi">
      <h3 className="kpi__label">{label}</h3>
      <p className={`kpi__value${value === NOT_AVAILABLE ? ' kpi__value--na' : ''}`}>{value}</p>
      <p className="kpi__meta">
        <span>{period}</span> <StatusBadge status={status} compact />
      </p>
      {children && <div className="kpi__note">{children}</div>}
    </article>
  );
}

export function KpiCards({ data }: { data: Dataset }) {
  const k = computeEuKpis(data.observations, data.metadata.targets);
  const t = k.target;
  const period = k.fatalities.period;
  const pathValue = t && period ? benchmarkPath(t).get(period) ?? null : null;
  const vsPath = pathValue != null && k.fatalities.value != null ? k.fatalities.value - pathValue : null;
  const progressPct = k.progress.value != null ? k.progress.value * 100 : null;

  return (
    <section aria-labelledby="kpi-heading">
      <h2 id="kpi-heading" className="visually-hidden">Key figures for the European Union</h2>
      <div className="kpi-grid">
        <Card label="EU road deaths" value={fmtInt(k.fatalities.value)} period={`Reference year ${period ?? 'n/a'}`} status={k.fatalities.status}>
          Persons killed within 30 days of a road crash, EU27.
        </Card>
        <Card
          label="Change on previous year"
          value={k.yoyAbs.value != null ? `${k.yoyAbs.value > 0 ? '+' : k.yoyAbs.value < 0 ? '−' : ''}${fmtInt(Math.abs(k.yoyAbs.value))}` : NOT_AVAILABLE}
          period={period ? `${period} vs ${k.yoyAbs.comparisonPeriod}` : 'n/a'}
          status={k.yoyAbs.status}
        >
          {fmtPct(k.yoyPct.value)} year on year. A single year's change does not establish a trend.
        </Card>
        <Card label="Deaths per million inhabitants" value={fmtRate(k.rate.value)} period={`Reference year ${period ?? 'n/a'}`} status={k.rate.status}>
          Derived from deaths and Eurostat average population.{k.rate.note ? ` ${k.rate.note}` : ''}
        </Card>
        <Card
          label={`Change since ${t?.baseline_period ?? '2019'} baseline`}
          value={fmtPct(k.baselineChangePct.value)}
          period={period && t ? `${period} vs ${t.baseline_period}` : 'n/a'}
          status={k.baselineChangePct.status}
        >
          {t?.baseline_value != null ? `Baseline: ${fmtInt(t.baseline_value)} deaths in ${t.baseline_period}.` : 'Baseline not available.'}
        </Card>
        <Card
          label={`Progress to ${t?.target_period ?? '2030'} benchmark`}
          value={progressPct != null ? `${fmtRate(progressPct)}%` : NOT_AVAILABLE}
          period={period ? `as of ${period}` : 'n/a'}
          status={k.progress.status}
        >
          {progressPct != null && t?.target_value != null ? (
            <>
              <div className="meter" role="img" aria-label={`${fmtRate(progressPct)}% of the required reduction achieved`}>
                <div className="meter__fill" style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }} />
              </div>
              Share of the required reduction of {fmtInt(k.progress.reductionRequired)} deaths achieved (benchmark:{' '}
              {fmtInt(t.target_value)} deaths in {t.target_period}).
              {vsPath != null && (
                <> The {period} figure is {fmtInt(Math.abs(vsPath))} {vsPath > 0 ? 'above' : 'below'} a straight-line path
                  from {t.baseline_period} to {t.target_period} (analytical benchmark, not an official forecast).</>
              )}
            </>
          ) : 'Not available.'}
        </Card>
      </div>
      <p className="small muted">
        The EU objective is to halve both road deaths <em>and</em> serious injuries by 2030 compared with 2019. These
        figures cover deaths only and do not measure the serious-injury objective. Status “No status flag” means Eurostat
        did not mark the value as provisional or estimated; official figures can still be revised.
      </p>
    </section>
  );
}
