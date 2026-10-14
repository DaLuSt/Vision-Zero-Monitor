import { useEffect, useMemo, useState } from 'react';
import type { Dataset } from '../../types/data';
import { EU } from '../../lib/indicators';
import {
  assignSlots, BUILDER_MEASURES, builderQuery, inRange, niceCeil, MAX_COMBINED_SERIES, MEASURES, measureSeries, parseBuilderParams,
  type BuilderState, type Layout,
} from '../../lib/chartData';
import { euComparableFrom, parseCategoryKey } from '../../lib/breakdowns';
import { Notice } from '../../components/States';
import { MultiSeriesChart, sourceLine, type ChartSeries } from './MultiSeriesChart';

const EU_LABEL = 'EU total';

export function ChartBuilder({ data, query }: { data: Dataset; query: string }) {
  const periods = useMemo(
    () => [...new Set(data.observations.filter((o) => o.indicator === 'road_fatalities').map((o) => o.period))].sort(),
    [data],
  );
  const countries = useMemo(() => [...data.countries].sort((a, b) => a.name.localeCompare(b.name)), [data]);
  // EU total first, then countries alphabetically: the order of charts, legend entries and URL.
  const names = useMemo(() => new Map<string, string>([[EU, EU_LABEL], ...countries.map((c) => [c.geo, c.name] as [string, string])]), [countries]);
  const order = (geos: string[]) => [...names.keys()].filter((g) => geos.includes(g));

  const bd = data.breakdowns ?? null;
  const catKeys = useMemo(() => (bd ? bd.dimensions.flatMap((d) => d.categories.map((c) => `${d.id}.${c.id}`)) : []), [bd]);

  const [state, setState] = useState<BuilderState>(() => {
    const parsed = parseBuilderParams(query, [...names.keys()], periods, catKeys);
    return { ...parsed, geos: order(parsed.geos) };
  });
  const [slots, setSlots] = useState<Record<string, number>>(() => assignSlots(state.geos, {}));
  const [sameScale, setSameScale] = useState(true);
  const [copied, setCopied] = useState(false);

  // Keep the URL shareable without triggering a navigation (replaceState fires no hashchange).
  useEffect(() => {
    const hash = `#/charts?${builderQuery(state)}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [state]);

  const update = (patch: Partial<BuilderState>) => setState((s) => {
    const next = { ...s, ...patch };
    if (next.from > next.to) [next.from, next.to] = [next.to, next.from];
    return next;
  });

  const setGeos = (geos: string[]) => {
    const ordered = order(geos);
    setSlots((prev) => assignSlots(ordered, prev));
    update({ geos: ordered });
  };
  const toggle = (geo: string) => setGeos(state.geos.includes(geo) ? state.geos.filter((g) => g !== geo) : [...state.geos, geo]);

  const series: ChartSeries[] = useMemo(() => state.geos.map((geo) => ({
    geo,
    name: names.get(geo) ?? geo,
    points: inRange(measureSeries(data.observations, geo, state.measure, bd, state.cat), state.from, state.to),
    color: `var(--cat-${(slots[geo] ?? 0) + 1})`,
  })), [data, state, slots, names]);

  const tooMany = state.layout === 'combined' && series.length > MAX_COMBINED_SERIES;
  const layout: Layout = tooMany ? 'separate' : state.layout;
  const scaleMismatch = layout === 'combined' && state.measure === 'deaths' && state.geos.includes(EU) && state.geos.length > 1;

  const sharedDomain = useMemo<[number, number] | undefined>(() => {
    if (layout !== 'separate' || !sameScale) return undefined;
    const max = Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.value ?? 0)));
    return max > 0 ? [0, niceCeil(max)] : undefined;
  }, [layout, sameScale, series]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const allCountries = countries.map((c) => c.geo);
  const cat = parseCategoryKey(state.cat, bd);
  const subject = cat ? `${cat.category.label} killed` : 'Road deaths';
  const source = sourceLine([
    cat ? cat.dimension.source_id.replace('eurostat:', '') : 'tran_sf_roadus',
    ...(state.measure === 'rate' ? ['demo_gind'] : []),
  ]);
  const subtitleFor = () => {
    const what = cat ? `${cat.category.label} killed` : 'Road deaths';
    const how = state.measure === 'rate' ? ' per million inhabitants' : state.measure === 'index' ? ', index 2019 = 100' : '';
    return `${what}${how}, ${state.from}–${state.to}`;
  };
  const measureLabel = MEASURES[state.measure].label.toLowerCase();

  return (
    <>
      <section className="panel" aria-labelledby="builder-heading">
        <div className="panel__head">
          <h2 id="builder-heading">Chart builder</h2>
          <button type="button" className="button button--ghost" onClick={copyLink}>
            {copied ? 'Link copied' : 'Copy link to this chart'}
          </button>
        </div>
        <p>
          Create a graph for the EU total and any Member State. Choose one combined chart or one chart per selection,
          then download it as an image or CSV. The link in your address bar always reproduces the current chart.
        </p>

        <div className="builder">
          <fieldset className="builder__geos">
            <legend>Geographies <span className="muted">({state.geos.length} selected)</span></legend>
            <label className="check check--eu">
              <input type="checkbox" checked={state.geos.includes(EU)} onChange={() => toggle(EU)} />
              {EU_LABEL} <span className="muted">(EU27)</span>
            </label>
            <div className="builder__quick">
              <button type="button" className="button button--ghost button--small" onClick={() => setGeos([...state.geos.filter((g) => g === EU), ...allCountries])}>All countries</button>
              <button type="button" className="button button--ghost button--small" onClick={() => setGeos(state.geos.filter((g) => g === EU))}>Clear countries</button>
            </div>
            <div className="check-grid">
              {countries.map((c) => (
                <label key={c.geo} className="check">
                  <input type="checkbox" checked={state.geos.includes(c.geo)} onChange={() => toggle(c.geo)} />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="builder__options">
            {bd && (
              <label className="field"><span>Who</span>
                <select value={state.cat ?? ''} onChange={(e) => update({ cat: e.target.value || null })}>
                  <option value="">All road deaths</option>
                  {bd.dimensions.map((d) => (
                    <optgroup key={d.id} label={`By ${d.label.toLowerCase()}`}>
                      {d.categories.map((c) => <option key={c.id} value={`${d.id}.${c.id}`}>{c.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
            )}
            <div className="field">
              <span id="measure-label">Measure</span>
              <div className="segmented segmented--stack" role="group" aria-labelledby="measure-label">
                {BUILDER_MEASURES.map((m) => (
                  <button key={m} type="button" aria-pressed={state.measure === m} onClick={() => update({ measure: m })}>{MEASURES[m].label}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <span id="layout-label">Layout</span>
              <div className="segmented" role="group" aria-labelledby="layout-label">
                <button type="button" aria-pressed={state.layout === 'combined'} onClick={() => update({ layout: 'combined' })}>One combined chart</button>
                <button type="button" aria-pressed={state.layout === 'separate'} onClick={() => update({ layout: 'separate' })}>One chart each</button>
              </div>
            </div>
            <div className="builder__years">
              <label className="field"><span>From</span>
                <select value={state.from} onChange={(e) => update({ from: e.target.value })}>
                  {periods.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label className="field"><span>To</span>
                <select value={state.to} onChange={(e) => update({ to: e.target.value })}>
                  {periods.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
            </div>
            {layout === 'separate' && (
              <label className="check">
                <input type="checkbox" checked={sameScale} onChange={(e) => setSameScale(e.target.checked)} />
                Same vertical scale for all charts
              </label>
            )}
          </div>
        </div>
      </section>

      {series.length === 0 ? (
        <section className="panel"><p className="state state--empty">Select the EU total or at least one country to create a chart.</p></section>
      ) : (
        <>
          {cat && bd && state.geos.includes(EU) && (euComparableFrom(bd, cat.dimension) ?? '') > state.from && (
            <Notice>
              EU figures for {cat.category.label.toLowerCase()} start in {euComparableFrom(bd, cat.dimension)}, the first
              year in which all 27 Member States reported this breakdown.
            </Notice>
          )}
          {tooMany && (
            <Notice tone="warning">
              A combined chart shows at most {MAX_COMBINED_SERIES} lines so that every line keeps a distinguishable colour.
              Showing one chart per selection instead.
            </Notice>
          )}
          {scaleMismatch && (
            <Notice>
              The EU total is far larger than any single country, so country lines will look flat. Try{' '}
              <button type="button" className="linklike" onClick={() => update({ measure: 'index' })}>index (2019 = 100)</button>,{' '}
              <button type="button" className="linklike" onClick={() => update({ measure: 'rate' })}>per million inhabitants</button> or{' '}
              <button type="button" className="linklike" onClick={() => update({ layout: 'separate' })}>one chart each</button>
            </Notice>
          )}
          {layout === 'combined' ? (
            <section className="panel">
              <MultiSeriesChart
                title={series.length === 1 ? `${subject}: ${series[0].name}` : `${subject}: ${series.length} geographies compared`}
                subtitle={subtitleFor()} source={source}
                series={series} measure={state.measure} from={state.from} to={state.to}
              />
            </section>
          ) : (
            <section aria-label={`One chart per selection, ${measureLabel}`} className="small-multiples">
              {series.map((s) => (
                <div key={s.geo} className="panel">
                  <MultiSeriesChart title={`${subject}: ${s.name}`} subtitle={subtitleFor()} source={source} series={[{ ...s, color: 'var(--series-1)' }]}
                    measure={state.measure} from={state.from} to={state.to} height={220} yDomain={sharedDomain} compact />
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
