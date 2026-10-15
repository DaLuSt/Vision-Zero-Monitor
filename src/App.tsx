import { useEffect, useState } from 'react';
import type { Dataset, Legislation as LegislationRegister } from './types/data';
import { loadDataset, loadLegislation } from './lib/data';
import { useRoute } from './lib/router';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ErrorState, LoadingState } from './components/States';
import { Overview } from './features/overview/Overview';
import { CountryTable } from './features/countries/CountryTable';
import { CountryDetail } from './features/countries/CountryDetail';
import { DataExplorer } from './features/data-explorer/DataExplorer';
import { ChartBuilder } from './features/charts/ChartBuilder';
import { RoadUsers } from './features/breakdowns/RoadUsers';
import { Legislation } from './features/legislation/Legislation';
import { Methodology } from './features/about/Methodology';
import { Sources } from './features/about/Sources';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: Dataset };

export default function App({ load = loadDataset, loadRegister = loadLegislation }: {
  load?: () => Promise<Dataset>;
  loadRegister?: () => Promise<LegislationRegister>;
}) {
  const route = useRoute();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ kind: 'ready', data }))
      .catch((e: unknown) => !cancelled && setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) }));
    return () => { cancelled = true; };
  }, [load]);

  const data = state.kind === 'ready' ? state.data : null;
  let content;
  // The legislation register has its own data file and does not depend on the statistics.
  if (route.page === 'legislation') content = <Legislation load={loadRegister} />;
  else if (state.kind === 'loading') content = <LoadingState />;
  else if (state.kind === 'error') content = <ErrorState message={state.message} />;
  else if (!state.data.observations.length) content = <ErrorState message="The dataset contains no observations." />;
  else {
    const d = state.data;
    switch (route.page) {
      case 'overview': content = <Overview data={d} />; break;
      case 'countries': content = <CountryTable data={d} />; break;
      case 'country': content = <CountryDetail data={d} geo={route.geo} />; break;
      case 'explorer': content = <DataExplorer data={d} />; break;
      case 'road-users': content = <RoadUsers key={route.query} data={d} query={route.query} />; break;
      case 'charts': content = <ChartBuilder key={route.query} data={d} query={route.query} />; break;
      case 'methodology': content = <Methodology data={d} />; break;
      case 'sources': content = <Sources data={d} />; break;
      default:
        content = <section className="panel"><h2>Page not found</h2><p><a href="#/">Return to the overview</a>.</p></section>;
    }
  }

  return (
    <>
      <Header route={route} data={data} />
      <main id="main" tabIndex={-1} className="main">{content}</main>
      <Footer />
    </>
  );
}
