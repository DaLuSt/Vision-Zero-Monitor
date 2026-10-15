import { render, screen, within } from '@testing-library/react';
import App from '../../App';
import { makeDataset } from '../../test/fixtures';
import { makeLegislation } from '../../test/legislationFixture';
import { makeCommitments } from '../../test/commitmentsFixture';

afterEach(() => { window.location.hash = ''; vi.useRealTimers(); });

async function renderCountry(geo: string, opts: { register?: () => Promise<never> } = {}) {
  window.location.hash = `#/countries/${geo}`;
  await new Promise((r) => setTimeout(r, 0));
  return render(
    <App load={() => Promise.resolve(makeDataset())}
      loadRegister={opts.register ?? (() => Promise.resolve(makeLegislation()))}
      loadPledges={() => Promise.resolve(makeCommitments())} />,
  );
}

describe('Country page', () => {
  it('compares the country with the EU and ranks its rate', async () => {
    await renderCountry('NL');
    expect(await screen.findByRole('heading', { name: 'Netherlands', level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/In 2023, the Netherlands recorded/)).toHaveTextContent(
      'In 2023, the Netherlands recorded 30.0 road deaths per million inhabitants, against 40.0 for the EU as a whole. That is the lowest rate of the 2 Member States with a figure for 2023.');
  });

  it('shows who dies, by road user and mode of transport', async () => {
    await renderCountry('NL');
    const who = await screen.findByRole('region', { name: 'Who dies on the roads in the Netherlands' });
    expect(within(who).getAllByRole('table')).toHaveLength(2);
    expect(within(who).getByRole('rowheader', { name: /Cyclists/ })).toBeInTheDocument();
    expect(within(who).getByRole('link', { name: /Trends and details/ })).toHaveAttribute('href', '#/road-users?geo=NL');
  });

  it('lists EU commitments covering the country and says national strategies are not yet covered', async () => {
    await renderCountry('NL');
    const section = await screen.findByRole('region', { name: 'Commitments covering the Netherlands' });
    expect(within(section).getByText(/not yet covered by this site/)).toBeInTheDocument();
    expect(await within(section).findByRole('link', { name: 'Halve road deaths and serious injuries by 2030' })).toHaveAttribute('href', '#/commitments');
    expect(within(section).queryByText('Second Decade of Action for Road Safety')).not.toBeInTheDocument(); // global, not EU
    expect(within(section).getByText(/apply to the EU as a whole/)).toBeInTheDocument();
  });

  it('lists upcoming transposition deadlines without judging compliance', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-15T12:00:00Z'), shouldAdvanceTime: true, toFake: ['Date'] });
    await renderCountry('NL');
    const section = await screen.findByRole('region', { name: 'Upcoming EU transposition deadlines' });
    expect(within(section).getByText(/does not track whether a country has done so/)).toBeInTheDocument();
    const item = (await within(section).findByRole('link', { name: /2025\/2205/ })).closest('li')!;
    expect(item).toHaveTextContent('26 Nov 2027, 26 Nov 2028, 26 Nov 2029'); // staged deadlines grouped per directive
  });

  it('keeps the rest of the page when the legislation file cannot be loaded', async () => {
    await renderCountry('NL', { register: () => Promise.reject(new Error('HTTP 404')) });
    expect(await screen.findByText('The legislation register could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Road deaths, Netherlands' })).toBeInTheDocument();
  });
});
