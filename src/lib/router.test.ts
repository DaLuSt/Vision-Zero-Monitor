import { pageTitle, parseHash } from './router';

describe('page titles', () => {
  it('names each page, and a country page after the country', () => {
    expect(pageTitle(parseHash('#/legislation'))).toBe('Legislation · Vision Zero Monitor');
    expect(pageTitle(parseHash(''))).toBe('Overview · Vision Zero Monitor');
    expect(pageTitle(parseHash('#/countries/nl'), (g) => (g === 'NL' ? 'Netherlands' : undefined))).toBe('Netherlands · Vision Zero Monitor');
    expect(pageTitle(parseHash('#/countries/XX'), () => undefined)).toBe('XX · Vision Zero Monitor');
    expect(pageTitle(parseHash('#/no-such-page'))).toBe('Page not found · Vision Zero Monitor');
  });
});
