import { DOCS_URL, DOI_ALL, ISSUES_URL, MAINTAINER_LINKEDIN_URL, MAINTAINER_URL, REPO_URL } from '../../lib/site';

export function About() {
  return (
    <article className="panel prose" aria-labelledby="about-heading">
      <h2 id="about-heading">About Vision Zero Monitor</h2>
      <p>
        Vision Zero Monitor follows Europe's progress towards Vision Zero: the EU objective of halving road deaths and
        serious injuries between 2020 and 2030, and moving close to zero road deaths by 2050. It brings official road
        safety statistics, EU legislation and policy commitments together in one place, so anyone can see where Europe
        stands and check every figure against its source.
      </p>

      <h3>Who is behind it</h3>
      <p>
        Vision Zero Monitor is an independent, non-commercial open-source project, built and maintained by Daan Steur
        (<a href={MAINTAINER_LINKEDIN_URL}>LinkedIn</a> · <a href={MAINTAINER_URL}>DaLuSt on GitHub</a>). It is not affiliated with, funded by or endorsed by the European Commission,
        Eurostat or any other organisation.
      </p>

      <h3>How it works</h3>
      <ul>
        <li>
          Data come only from official sources: Eurostat for statistics, EUR-Lex for legislation, and the official
          documents themselves for policy commitments (quoted word for word).
        </li>
        <li>
          An automated pipeline checks for new data every week, validates it, and publishes it only if all checks pass.
          Otherwise the last valid data stay online.
        </li>
        <li>
          Missing values stay missing. Nothing is estimated, interpolated or labelled “on track” on the project's own
          judgement.
        </li>
        <li>
          All code, data files and earlier versions are public on <a href={REPO_URL}>GitHub</a>. Methods are described on
          the <a href="#/methodology">methodology page</a>; sources and data checks on the{' '}
          <a href="#/sources">sources page</a>.
        </li>
      </ul>

      <h3>Report an error or give feedback</h3>
      <p>
        Found a figure that does not match the official source, a broken link, or something unclear? Please{' '}
        <a href={ISSUES_URL}>open an issue on GitHub</a> with the page, the figure and, if possible, the source value. Ideas
        and contributions are welcome too.
      </p>

      <h3>Citing this site</h3>
      <p>
        Cite the official source of a figure first (for example Eurostat, dataset <code>tran_sf_roadus</code>). To refer to
        this site:
      </p>
      <blockquote className="citation">
        Steur, D. (2026). <em>Vision Zero Monitor: EU road safety statistics, legislation and commitments</em> [software
        and data]. Zenodo. <a href={`https://doi.org/${DOI_ALL}`}>https://doi.org/{DOI_ALL}</a>
      </blockquote>
      <p>
        This DOI always points to the latest release. Every release of the code and data files is archived on Zenodo with
        its own DOI, so you can also cite the exact version you used (listed on the Zenodo page). The repository's{' '}
        <a href={`${REPO_URL}/blob/main/CITATION.cff`}>citation file</a> gives the details in a machine-readable
        form; on GitHub, use “Cite this repository”.
      </p>

      <h3>Privacy</h3>
      <p>
        This site sets no cookies and uses no analytics or tracking. It is hosted on GitHub Pages; GitHub may process
        technical data such as IP addresses to deliver and secure the site, as described in the{' '}
        <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">
          GitHub privacy statement
        </a>.
      </p>

      <h3>Licence</h3>
      <p>
        Code: <a href={`${REPO_URL}/blob/main/LICENSE`}>MIT licence</a>. Data: © European Union; reuse is subject to the{' '}
        <a href="https://ec.europa.eu/eurostat/about-us/policies/copyright">Eurostat copyright notice</a> and, for
        legislation, Commission Decision 2011/833/EU. Scope and roadmap: <a href={`${DOCS_URL}/SCOPE.md`}>SCOPE.md</a>.
      </p>
    </article>
  );
}
