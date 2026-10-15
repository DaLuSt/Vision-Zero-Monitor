import { makeDataset } from '../test/fixtures';
import { euComparison, inSentence, ordinal, rankPhrase } from './country';

describe('euComparison', () => {
  const d = makeDataset();

  it('compares the latest rate with the EU rate of the same year and ranks it (1 = lowest)', () => {
    expect(euComparison(d.observations, d.countries, 'NL')).toEqual({ period: '2023', rate: 30, euRate: 40, rank: 1, ranked: 2 });
    expect(euComparison(d.observations, d.countries, 'BE')).toMatchObject({ rank: 2, ranked: 2 });
  });

  it('returns null when a country has no rate', () => {
    expect(euComparison(d.observations, d.countries, 'XX')).toBeNull();
  });
});

it('phrases ranks naturally', () => {
  expect([rankPhrase(1, 27), rankPhrase(6, 27), rankPhrase(27, 27)]).toEqual(['the lowest', 'the 6th lowest', 'the highest']);
});

it.each([[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [27, '27th']])(
  'ordinal(%i) = %s', (n, s) => expect(ordinal(n)).toBe(s));

it('uses the article for the Netherlands in sentences', () => {
  expect([inSentence('Netherlands'), inSentence('Belgium')]).toEqual(['the Netherlands', 'Belgium']);
});
