import type { Breakdowns, Commitments, Dataset, Legislation, Metadata, Observation, PipelineStatus, Country, Indicator } from '../types/data';

export const DATA_BASE = `${import.meta.env.BASE_URL}data/`;

export class DataLoadError extends Error {}

async function getJson<T>(name: string, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(`${DATA_BASE}${name}`, { cache: 'no-cache' });
  if (!res.ok) throw new DataLoadError(`Could not load ${name} (HTTP ${res.status}).`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new DataLoadError(`${name} is not valid JSON.`);
  }
}

export async function loadDataset(fetchImpl: typeof fetch = fetch): Promise<Dataset> {
  const [obs, countries, indicators, metadata] = await Promise.all([
    getJson<{ observations: Observation[] }>('observations.json', fetchImpl),
    getJson<{ countries: Country[] }>('countries.json', fetchImpl),
    getJson<{ indicators: Indicator[] }>('indicators.json', fetchImpl),
    getJson<Metadata>('metadata.json', fetchImpl),
  ]);
  // The pipeline status is informative only; its absence must not break the dashboard.
  const [pipelineStatus, breakdowns] = await Promise.all([
    getJson<PipelineStatus>('pipeline_status.json', fetchImpl).catch(() => null),
    // Breakdowns are optional: the core dashboard works without them.
    getJson<Breakdowns>('breakdowns.json', fetchImpl)
      .then((b) => (Array.isArray(b?.series) && Array.isArray(b?.periods) ? b : null))
      .catch(() => null),
  ]);
  if (!Array.isArray(obs?.observations) || !Array.isArray(countries?.countries)) {
    throw new DataLoadError('The data files have an unexpected structure.');
  }
  return {
    observations: obs.observations,
    countries: countries.countries,
    indicators: indicators.indicators ?? [],
    metadata,
    pipelineStatus,
    breakdowns,
  };
}

/** The legislation register is loaded only on the legislation page (it is larger than the statistics). */
export async function loadLegislation(fetchImpl: typeof fetch = fetch): Promise<Legislation> {
  const doc = await getJson<Legislation>('legislation.json', fetchImpl);
  if (!Array.isArray(doc?.acts) || !Array.isArray(doc?.proposals) || !doc.summary || !doc.source) {
    throw new DataLoadError('legislation.json has an unexpected structure.');
  }
  return doc;
}

/** Policy commitments, loaded only on the commitments page. */
export async function loadCommitments(fetchImpl: typeof fetch = fetch): Promise<Commitments> {
  const doc = await getJson<Commitments>('commitments.json', fetchImpl);
  if (!Array.isArray(doc?.commitments) || !doc.summary) {
    throw new DataLoadError('commitments.json has an unexpected structure.');
  }
  return doc;
}
