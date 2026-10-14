import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { makeDataset } from '../../test/fixtures';
import type { Dataset } from '../../types/data';
import * as exportChart from '../../lib/exportChart';

vi.mock('../../lib/exportChart', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/exportChart')>()),
  downloadChartPng: vi.fn(async () => {}),
  downloadText: vi.fn(),
}));

async function renderAt(hash: string, data: Dataset = makeDataset()) {
  window.location.hash = hash;
  // Let jsdom deliver the hashchange from the assignment above before mounting,
  // as a browser does when a link is followed.
  await new Promise((r) => setTimeout(r, 0));
  return render(<App load={() => Promise.resolve(data)} />);
}

const titleOf = (fig: HTMLElement) => fig.querySelector('.chart__title')?.firstChild?.textContent;

afterEach(() => { window.location.hash = ''; vi.clearAllMocks(); });

describe('Chart builder', () => {
  it('defaults to the EU total and is reachable from the navigation', async () => {
    await renderAt('#/charts');
    expect(await screen.findByRole('heading', { name: 'Chart builder' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /EU total/ })).toBeChecked();
    expect(screen.getByRole('figure', { name: /Road deaths: EU total/ })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Chart builder' })).toHaveAttribute('aria-current', 'page');
  });

  it('restores a chart from a shared link', async () => {
    await renderAt('#/charts?geo=EU27_2020,NL&measure=rate&layout=combined&from=2019&to=2023');
    const fig = await screen.findByRole('figure', { name: /2 geographies compared/ });
    expect(fig.querySelector('.chart__subtitle')).toHaveTextContent('Road deaths per million inhabitants, 2019–2023');
    expect(screen.getByRole('checkbox', { name: 'Netherlands' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Per million inhabitants' })).toHaveAttribute('aria-pressed', 'true');
    // Legend and per-series summaries (identity is never colour alone).
    const legend = within(fig).getByRole('list', { name: 'Legend' });
    expect(within(legend).getByText('Netherlands')).toBeInTheDocument();
    expect(within(fig).getByText(/^EU total went from/)).toBeInTheDocument();
  });

  it('adds a country, switches measure and keeps the URL in sync without navigating', async () => {
    const user = userEvent.setup();
    await renderAt('#/charts');
    await screen.findByRole('heading', { name: 'Chart builder' });
    await user.click(screen.getByRole('checkbox', { name: 'Belgium' }));
    await user.click(screen.getByRole('button', { name: 'Index (2019 = 100)' }));
    expect(screen.getByRole('figure', { name: /2 geographies compared/ })).toBeInTheDocument();
    expect(window.location.hash).toContain('geo=EU27_2020,BE');
    expect(window.location.hash).toContain('measure=index');
    expect(screen.getByText(/Index: deaths in each year ÷ deaths in 2019 × 100/)).toBeInTheDocument();
  });

  it('suggests a comparable measure when the EU total dwarfs a country', async () => {
    const user = userEvent.setup();
    await renderAt('#/charts?geo=EU27_2020,NL&measure=deaths');
    expect(await screen.findByText(/far larger than any single country/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'index (2019 = 100)' }));
    expect(screen.queryByText(/far larger than any single country/)).not.toBeInTheDocument();
    expect(window.location.hash).toContain('measure=index');
  });

  it('draws one chart per selection', async () => {
    const user = userEvent.setup();
    await renderAt('#/charts?geo=EU27_2020,NL,BE');
    await user.click(await screen.findByRole('button', { name: 'One chart each' }));
    const figs = screen.getAllByRole('figure');
    expect(figs.map(titleOf)).toEqual(['Road deaths: EU total', 'Road deaths: Belgium', 'Road deaths: Netherlands']);
    expect(screen.getByRole('checkbox', { name: /Same vertical scale/ })).toBeChecked();
  });

  it('falls back to one chart each beyond eight combined lines', async () => {
    const d = makeDataset();
    const extra = ['AT', 'CY', 'CZ', 'DE', 'DK', 'EE', 'FI'].map((g) => ({ geo: g, iso2: g, name: `Country ${g}`, eu_member: true }));
    await renderAt(`#/charts?geo=EU27_2020,BE,MT,NL,${extra.map((e) => e.geo).join(',')}`, { ...d, countries: [...d.countries, ...extra] });
    expect(await screen.findByText(/at most 8 lines/)).toBeInTheDocument();
    expect(screen.getAllByRole('figure')).toHaveLength(11);
  });

  it('shows an empty state when nothing is selected', async () => {
    const user = userEvent.setup();
    await renderAt('#/charts');
    await user.click(await screen.findByRole('checkbox', { name: /EU total/ }));
    expect(screen.getByText(/Select the EU total or at least one country/)).toBeInTheDocument();
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });

  it('selects and clears all countries', async () => {
    const user = userEvent.setup();
    await renderAt('#/charts');
    await user.click(await screen.findByRole('button', { name: 'All countries' }));
    expect(screen.getByText('(4 selected)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear countries' }));
    expect(screen.getByText('(1 selected)')).toBeInTheDocument();
  });

  it('downloads the chart as PNG and CSV', async () => {
    const user = userEvent.setup();
    await renderAt('#/charts?geo=EU27_2020,NL&measure=rate&from=2019&to=2023');
    const fig = await screen.findByRole('figure', { name: /2 geographies compared/ });
    await user.click(within(fig).getByRole('button', { name: /^PNG/ }));
    // jsdom renders no SVG for ResponsiveContainer; the button reports that clearly instead of failing silently.
    const pngCalls = vi.mocked(exportChart.downloadChartPng).mock.calls;
    if (pngCalls.length) {
      expect(pngCalls[0][1].legend.map((l) => l.label)).toEqual(['EU total', 'Netherlands']);
      expect(pngCalls[0][2]).toBe('road-deaths-2-geographies-compared-rate-2019-2023.png');
    } else {
      expect(within(fig).getByRole('alert')).toHaveTextContent(/not rendered/);
    }
    await user.click(within(fig).getByRole('button', { name: /^CSV/ }));
    const [csv, filename] = vi.mocked(exportChart.downloadText).mock.calls[0];
    expect(filename).toBe('road-deaths-2-geographies-compared-rate-2019-2023.csv');
    expect(csv).toContain('NL,Netherlands,2023,rate,30,unknown');
    expect(csv).not.toContain(',2018,'); // only the selected range
  });

  it('links from a country page to a comparison with the EU total', async () => {
    await renderAt('#/countries/NL');
    expect(await screen.findByRole('link', { name: /Compare Netherlands with the EU total/ }))
      .toHaveAttribute('href', '#/charts?geo=EU27_2020,NL&measure=rate');
  });
});
