import type { Dataset, Status } from '../../types/data';
import { fmtInt, STATUS_DESCRIPTION, STATUS_LABEL } from '../../lib/format';
import { DOCS_URL } from '../../lib/site';
import { StatusBadge } from '../../components/StatusBadge';

export function Methodology({ data }: { data: Dataset }) {
  const t = data.metadata.targets[0];
  return (
    <article className="panel prose" aria-labelledby="method-heading">
      <h2 id="method-heading">Methodology</h2>
      <p>Summary of the full <a href={`${DOCS_URL}/METHODOLOGY.md`}>methodology document</a>.</p>

      <h3>What is counted</h3>
      <p>
        A road fatality is a person killed immediately or dying within 30 days as a result of a road traffic accident,
        excluding suicides. Countries that do not record deaths up to 30 days apply correction factors in the official
        data. Figures are annual totals compiled by the European Commission (DG MOVE) in the CARE database and
        disseminated by Eurostat.
      </p>

      <h3>Three different dates</h3>
      <ul>
        <li><strong>Reference year</strong> – the year in which the deaths occurred.</li>
        <li><strong>Source publication date</strong> – when Eurostat last updated the dataset.</li>
        <li><strong>Retrieval date</strong> – when this dashboard's pipeline downloaded it.</li>
      </ul>
      <p>{data.metadata.frequency_notice}</p>

      <h3>Observation status</h3>
      <dl className="status-list">
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <div key={s}><dt><StatusBadge status={s} /></dt><dd>{STATUS_DESCRIPTION[s]}</dd></div>
        ))}
      </dl>
      <p>
        Eurostat does not publish an explicit “final” flag. Values without a flag are therefore shown as “No status
        flag” rather than being assumed final.
      </p>

      <h3 id="rates">Rates per million inhabitants</h3>
      <p>
        Rate = deaths ÷ average population of the year × 1,000,000, using Eurostat's average population (demo_gind,
        mean of 1 January populations of consecutive years). A rate inherits the most cautious status of its inputs:
        if the population is provisional or estimated, so is the rate. Derived rates are cross-checked against
        Eurostat's own SDG indicator (sdg_11_40).
      </p>

      <h3>2030 target and benchmark</h3>
      <p>
        {t?.note} The fatality benchmark is the official 2019 EU27 total × 0.5
        {t?.baseline_value != null && t.target_value != null && <> = {fmtInt(t.baseline_value)} × 0.5 = {t.target_value} deaths (shown rounded as {fmtInt(t.target_value)})</>}.
        Change from baseline = (current − baseline) ÷ baseline × 100.
      </p>
      <p>
        The straight-line path from 2019 to 2030 shown in the chart is an <strong>analytical benchmark</strong>, not an
        official forecast or trajectory. A single year's change does not show whether the EU is on or off track.
        Comparisons using provisional values may change when final data are published.
      </p>

      <h3 id="commitments">Policy commitments</h3>
      <p>
        The <a href="#/commitments">commitments page</a> quotes each commitment word for word from the official
        document, with a link to it. The EU Road Safety Policy Framework 2021–2030 states its targets as −50 % “between
        2020 and 2030”, while the European Commission's own progress charts measure the road-death target from 2019;
        both baselines are shown. A target value is the official baseline figure × (1 − the stated reduction). Targets
        set for the EU of an earlier date are compared with today's EU-27 figures, which is noted where it applies.
        Details in the <a href={`${DOCS_URL}/METHODOLOGY.md#policy-commitments`}>methodology document</a>.
      </p>

      <h3>Road users and modes of transport</h3>
      <p>
        Deaths are split by road user (drivers and riders, passengers, pedestrians) and by mode of transport. Eurostat's
        27 vehicle codes are grouped into 8 categories; some codes that sound like totals (for example “two-wheeled motor
        vehicles”) are in fact “not elsewhere classified” remainders, so all motorcycle codes are added together.
        Eurostat's “Other” vehicle category holds people not in a vehicle and is shown as pedestrians. EU breakdowns are
        shown from 2016, the first year all 27 Member States reported them. Full mapping in the{' '}
        <a href={`${DOCS_URL}/METHODOLOGY.md#breakdowns`}>methodology document</a>.
      </p>

      <h3>Missing data and revisions</h3>
      <p>
        Missing values are never replaced by zero, interpolated or carried forward. Charts show gaps. The EU total is
        Eurostat's official EU27_2020 aggregate, never a sum calculated here. Official data can be revised; each weekly
        run compares new values with the previous dataset and flags large revisions. Every published version is kept in
        the Git history.
      </p>

      <h3 id="legislation">Legislation register</h3>
      <p>
        The <a href="#/legislation">legislation register</a> lists EU legal acts and Commission proposals that the
        Publications Office of the EU indexes under the subject “road safety” (EuroVoc 4047), plus a few core acts indexed
        elsewhere, each marked as a curated addition with its reason. Dates and the in-force status are shown as recorded
        in EUR-Lex. A proposal counts as pending when no adopting act and no end date are recorded; after five years
        without either, its status is shown as unclear. Transposition deadlines are marked passed or upcoming by date
        only: the register does not assess whether Member States comply. Details in the{' '}
        <a href={`${DOCS_URL}/METHODOLOGY.md#legislation-register`}>methodology document</a>.
      </p>
    </article>
  );
}
