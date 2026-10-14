import { fmtInt, fmtPct, fmtRate, fmtDate } from './format';
import { parseHash } from './router';

describe('formatting', () => {
  it('shows "Not available" for missing values instead of zero', () => {
    expect(fmtInt(null)).toBe('Not available');
    expect(fmtRate(undefined)).toBe('Not available');
    expect(fmtPct(null)).toBe('Not available');
  });
  it('formats numbers', () => {
    expect(fmtInt(19933)).toBe('19,933');
    expect(fmtRate(44.29)).toBe('44.3');
    expect(fmtPct(-12.41)).toBe('−12.4%');
    expect(fmtPct(3)).toBe('+3.0%');
    expect(fmtDate('2026-08-25T21:00:00Z')).toBe('25 Aug 2026');
  });
});

describe('routing', () => {
  it('parses hash routes', () => {
    expect(parseHash('')).toEqual({ page: 'overview' });
    expect(parseHash('#/countries')).toEqual({ page: 'countries' });
    expect(parseHash('#/countries/nl')).toEqual({ page: 'country', geo: 'NL' });
    expect(parseHash('#/explorer')).toEqual({ page: 'explorer' });
    expect(parseHash('#/nope')).toEqual({ page: 'notfound' });
  });
});
