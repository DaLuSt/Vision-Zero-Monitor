import { Suspense, useEffect, useState } from 'react';
import type { Commitments as CommitmentsDoc, Dataset, Legislation as LegislationRegister } from './types/data';
import { loadCommitments, loadDataset, loadLegislation } from './lib/data';
import { pageTitle, useRoute } from './lib/router';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ErrorState, LoadingState } from './components/States';
import { Overview } from './features/overview/Overview';
import { lazyPage } from './lib/lazyPage';

// Pages other than the overview are loaded on demand, so the first visit downloads less JavaScript.
const CountryTable = lazyPage(() => import('./features/countries/CountryTable'), 'CountryTable');
const CountryDetail = lazyPage(() => import('./features/countries/CountryDetail'), 'CountryDetail');
const DataExplorer = lazyPage(() => import('./features/data-explorer/DataExplorer'), 'DataExplorer');
const ChartBuilder = lazyPage(() => import('./features/charts/ChartBuilder'), 'ChartBuilder');
const RoadUsers = lazyPage(() => import('./features/breakdowns/RoadUsers'), 'RoadUsers');
const Legislation = lazyPage(() => import('./features/legislation/Legislation'), 'Legislation');
const Commitments = lazyPage(() => import('./features/commitments/Commitments'), 'Commitments');
const About = lazyPage(() => import('./features/about/About'), 'About');
const DataFiles = lazyPage(() => import('./features/about/DataFiles'), 'DataFiles');
const Methodology = lazyPage(() => import('./features/about/Methodology'), 'Methodology');
const Sources = lazyPage(() => import('./features/about/Sources'), 'Sources');

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: Dataset };

export default function App({ load = loadDataset, loadRegister = loadLegislation, loadPledges = loadCommitments }: {
  load?: () => Promise<Dataset>;
  loadRegister?: () => Promise<LegislationRegister>;
  loadPledges?: () => Promise<CommitmentsDoc>;
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
  useEffect(() => {
    document.title = pageTitle(route, (geo) => data?.countries.find((c) => c.geo === geo)?.name);
  }, [route, data]);
  let content;
  // The legislation register has its own data file and does not depend on the statistics.
  if (route.page === 'legislation') content = <Legislation load={loadRegister} />;
  else if (route.page === 'about') content = <About />;
  else if (route.page === 'data') content = <DataFiles />;
  else if (state.kind === 'loading') content = <LoadingState />;
  else if (state.kind === 'error') content = <ErrorState message={state.message} />;
  else if (!state.data.observations.length) content = <ErrorState message="The dataset contains no observations." />;
  else {
    const d = state.data;
    switch (route.page) {
      case 'overview': content = <Overview data={d} />; break;
      case 'countries': content = <CountryTable data={d} />; break;
      case 'country': content = <CountryDetail data={d} geo={route.geo} loadRegister={loadRegister} loadPledges={loadPledges} />; break;
      case 'explorer': content = <DataExplorer data={d} />; break;
      case 'road-users': content = <RoadUsers key={route.query} data={d} query={route.query} />; break;
      case 'charts': content = <ChartBuilder key={route.query} data={d} query={route.query} />; break;
      case 'commitments': content = <Commitments data={d} load={loadPledges} />; break;
      case 'methodology': content = <Methodology data={d} />; break;
      case 'sources': content = <Sources data={d} />; break;
      default:
        content = <section className="panel"><h2>Page not found</h2><p><a href="#/">Return to the overview</a>.</p></section>;
    }
  }

  return (
    <>
      <Header route={route} data={data} />
      <main id="main" tabIndex={-1} className="main"><Suspense fallback={<LoadingState />}>{content}</Suspense></main>
      <Footer />
    </>
  );
}
