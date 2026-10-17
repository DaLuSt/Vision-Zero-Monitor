import { render, screen, within } from '@testing-library/react';
import App from '../../App';
import { makeDataset } from '../../test/fixtures';
import { makeCommitments, makeCommitmentsWithNational } from '../../test/commitmentsFixture';
import { byLevel, chartRows, nationalFor, targetPaths } from '../../lib/commitments';

afterEach(() => { window.location.hash = ''; });

async function renderPage(load = () => Promise.resolve(makeCommitments())) {
  window.location.hash = '#/commitments';
  await new Promise((r) => setTimeout(r, 0));
  return render(<App load={() => Promise.resolve(makeDataset())} loadPledges={load} />);
}

describe('commitments helpers', () => {
  it('draws one line per distinct target, oldest first', () => {
    const paths = targetPaths(makeCommitments());
    expect(paths.map((p) => [p.from.year, p.to.year, p.from.value, p.to.value])).toEqual([
      [2018, 2020, 1100, 550], [2018, 2030, 1100, 550], [2019, 2030, 1000, 500],
    ]);
    expect(paths.find((p) => p.from.year === 2018 && p.to.year === 2030)?.label).toMatch(/Commission monitoring/);
  });

  it('does not draw national targets on the EU chart', () => {
    const doc = makeCommitmentsWithNational();
    expect(targetPaths(doc).map((p) => p.from.year)).not.toContain(2017);
    expect(targetPaths(doc)).toHaveLength(targetPaths(makeCommitments()).length);
    expect(nationalFor(doc, 'NL').map((c) => c.id)).toEqual(['nl-test']);
    expect(nationalFor(doc, 'DE')).toEqual([]);
    expect(byLevel(doc).map((g) => g.level)).toEqual(['eu', 'national', 'global']);
  });

  it('puts the official series and the target end points on one year axis', () => {
    const paths = targetPaths(makeCommitments());
    const rows = chartRows(makeDataset().observations, paths);
    expect(rows[0].year).toBe(2018);
    expect(rows[rows.length - 1].year).toBe(2030);
    const r2021 = rows.find((r) => r.year === 2021)!;
    expect(r2021.deaths).toBeNull(); // missing stays missing
    const r2030 = rows.find((r) => r.year === 2030)!;
    expect(r2030.deaths).toBeNull();
    expect(r2030[paths[2].key]).toBe(500);
  });

  it('groups EU before global commitments', () => {
    expect(byLevel(makeCommitments()).map((g) => g.level)).toEqual(['eu', 'global']);
  });
});

describe('Commitments page', () => {
  it('quotes each commitment with a link to the official text', async () => {
    await renderPage();
    expect(await screen.findByRole('heading', { name: 'Policy commitments' })).toBeInTheDocument();
    const eu = screen.getByRole('region', { name: 'European Union' });
    const card = within(eu).getByRole('article', { name: 'Halve road deaths and serious injuries by 2030' });
    expect(within(card).getByText(/reducing the number of road deaths by 50% between 2019 and 2030/)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'SWD(2019) 283 final' })).toHaveAttribute('href', expect.stringContaining('op.europa.eu'));
    expect(within(card).getByText('Not legally binding')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('None of these commitments is legally binding');
  });

  it('shows target values and official figures for both baselines', async () => {
    await renderPage();
    const card = await screen.findByRole('article', { name: 'Halve road deaths and serious injuries by 2030' });
    const table = within(card).getByRole('table', { name: /Road deaths −50 %/ });
    const [stated, monitoring] = within(table).getAllByRole('row').slice(1);
    expect(stated).toHaveTextContent('2019');
    expect(stated).toHaveTextContent('As stated in the document');
    expect(stated).toHaveTextContent('500');
    expect(stated).toHaveTextContent('−20.0%');
    expect(monitoring).toHaveTextContent('Commission monitoring baseline');
    expect(within(card).getByText(/The Commission measures this target against 2018/)).toBeInTheDocument();
    expect(within(card).getByText('Comparable serious-injury figures are not yet included.')).toBeInTheDocument();
  });

  it('notes scope limits and lists global commitments separately', async () => {
    await renderPage();
    expect(await screen.findByText('Set for the EU as it was in 2010.')).toBeInTheDocument();
    const global = screen.getByRole('region', { name: 'Global' });
    expect(within(global).getByRole('article', { name: 'Second Decade of Action for Road Safety' })).toHaveTextContent(
      'A global goal; this dashboard covers the EU only.');
  });

  it('draws the chart with a legend entry per target and a data table', async () => {
    await renderPage();
    const fig = await screen.findByRole('figure', { name: /each measurable target drawn as a straight line/ });
    expect(within(fig).getAllByRole('listitem')).toHaveLength(4);
    expect(within(fig).getByRole('table')).toBeInTheDocument();
  });

  it('shows national strategies with the original quote and a labelled translation', async () => {
    await renderPage(() => Promise.resolve(makeCommitmentsWithNational()));
    const section = await screen.findByRole('region', { name: 'National strategies' });
    const card = within(section).getByRole('article', { name: 'Netherlands: test strategy' });
    const original = within(card).getByText('“Het streven is nul verkeersslachtoffers.”').closest('blockquote')!;
    expect(original).toHaveAttribute('lang', 'nl');
    expect(within(card).getByText('English translation by this site (not official)')).toBeInTheDocument();
    expect(within(card).getByText('“The aim is zero road casualties.”').closest('blockquote')).toHaveAttribute('lang', 'en');
    expect(within(card).getByRole('row', { name: /2017/ })).toHaveTextContent('560');
  });

  it('is in the main navigation', async () => {
    await renderPage();
    await screen.findByRole('heading', { name: 'Policy commitments' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Commitments' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows an error when the file cannot be loaded', async () => {
    await renderPage(() => Promise.reject(new Error('Could not load commitments.json (HTTP 404).')));
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404');
  });
});
