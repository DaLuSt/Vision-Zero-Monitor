import type { Country, Observation } from '../types/data';
import { EU, latestPoint, pointAt, series } from './indicators';

export interface EuComparison {
  period: string;
  rate: number;
  euRate: number | null;
  /** 1 = lowest rate per million among Member States with a rate for the same year; ties share a rank. */
  rank: number;
  ranked: number;
}

/** The country's latest rate per million, the EU rate for the same year and its rank among Member States. */
export function euComparison(obs: Observation[], countries: Country[], geo: string): EuComparison | null {
  const own = latestPoint(series(obs, geo, 'road_fatalities_per_million'));
  if (!own || own.value == null) return null;
  const rates = countries
    .map((c) => pointAt(series(obs, c.geo, 'road_fatalities_per_million'), own.period)?.value)
    .filter((v): v is number => v != null);
  const eu = pointAt(series(obs, EU, 'road_fatalities_per_million'), own.period)?.value ?? null;
  return {
    period: own.period,
    rate: own.value,
    euRate: eu,
    rank: 1 + rates.filter((r) => r < own.value!).length,
    ranked: rates.length,
  };
}

/** Country name as used inside a sentence ("the Netherlands"). */
export function inSentence(name: string): string {
  return name === 'Netherlands' ? 'the Netherlands' : name;
}

/** "the lowest", "the 6th lowest", "the highest" (1 = lowest). */
export function rankPhrase(rank: number, of: number): string {
  if (rank === 1) return 'the lowest';
  if (rank === of) return 'the highest';
  return `the ${ordinal(rank)} lowest`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
