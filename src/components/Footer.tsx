import { REPO_URL } from '../lib/site';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>
          Source: Eurostat (<a href="https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadus/default/table">tran_sf_roadus</a>,{' '}
          <a href="https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadve/default/table">tran_sf_roadve</a>,{' '}
          <a href="https://ec.europa.eu/eurostat/databrowser/view/demo_gind/default/table">demo_gind</a>), based on the
          European Commission's CARE database. Reuse of Eurostat data is subject to the{' '}
          <a href="https://ec.europa.eu/eurostat/about-us/policies/copyright">Eurostat copyright notice</a>. Legislation:
          EUR-Lex metadata from the Publications Office of the European Union, © European Union.
        </p>
        <p>
          Currently published: official road-death statistics for the 27 EU Member States and a register of EU road
          safety legislation. Policy-commitment tracking is in development (<a href={`${REPO_URL}/blob/main/docs/SCOPE.md`}>scope and roadmap</a>).
        </p>
        <p>
          Vision Zero Monitor is an independent open-source project, not an official publication of the European Union.
          No tracking or analytics. <a href="#/about">About this project</a> · <a href={REPO_URL}>Source code (MIT)</a>.
        </p>
      </div>
    </footer>
  );
}
