import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { loadDataset } from './lib/data';
import { makeDataset } from './test/fixtures';
import type { Dataset } from './types/data';

function renderAt(hash: string, data: Dataset | Error = makeDataset()) {
  window.location.hash = hash;
  const load = data instanceof Error ? () => Promise.reject(data) : () => Promise.resolve(data);
  return render(<App load={load} />);
}

afterEach(() => { window.location.hash = ''; });

describe('App', () => {
  it('shows a loading state, then the KPIs with reference periods and status', async () => {
    renderAt('#/');
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    const deaths = await screen.findByText('800', { selector: '.kpi__value' });
    expect(deaths).toBeInTheDocument();
    expect(screen.getAllByText(/Reference year 2023/).length).toBeGreaterThan(0);
    expect(screen.getByText('−20.0%')).toBeInTheDocument(); // change vs 2019
    expect(screen.getByText('40.0%')).toBeInTheDocument(); // progress to benchmark
    expect(screen.getAllByText(/Provisional/).length).toBeGreaterThan(0);
    expect(screen.getByText(/checks for updated data weekly/)).toBeInTheDocument();
  });

  it('renders the EU chart with an accessible summary and data table', async () => {
    renderAt('#/');
    const fig = await screen.findByRole('figure', { name: /Road deaths, European Union/ });
    expect(within(fig).getByText(/EU road deaths went from 1,100 in 2018 to 800 in 2023/)).toBeInTheDocument();
    expect(within(fig).getByText(/No data for 2021/)).toBeInTheDocument();
    expect(within(fig).getByText('Show data table')).toBeInTheDocument();
    const table = within(fig).getByRole('table', { hidden: true });
    expect(within(table).getByText('2021').closest('tr')).toHaveTextContent('Not available');
    expect(within(fig).getByText(/Linear path to 2030 benchmark/)).toBeInTheDocument();
  });

  it('toggles between counts and rates', async () => {
    const user = userEvent.setup();
    renderAt('#/');
    await user.click(await screen.findByRole('button', { name: 'Per million inhabitants' }));
    expect(screen.getByRole('figure', { name: /per million inhabitants, European Union/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Per million inhabitants' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows an error state when data cannot be loaded', async () => {
    renderAt('#/', new Error('Could not load observations.json (HTTP 404).'));
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404');
    expect(screen.queryByText('800', { selector: '.kpi__value' })).not.toBeInTheDocument();
  });

  it('shows an unavailable state for an empty dataset', async () => {
    renderAt('#/', makeDataset({ observations: [] }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no observations/i);
  });

  it('shows "Not available" KPIs when the EU series is missing', async () => {
    const d = makeDataset();
    renderAt('#/', { ...d, observations: d.observations.filter((o) => o.geo !== 'EU27_2020') });
    await screen.findByText('EU road deaths');
    expect(screen.getAllByText('Not available').length).toBeGreaterThanOrEqual(4);
  });

  it('flags a failed pipeline run while keeping the last valid data', async () => {
    const d = makeDataset();
    renderAt('#/', { ...d, pipelineStatus: { ...d.pipelineStatus!, last_outcome: 'failure', message: 'FetchError: HTTP 503.' } });
    expect(await screen.findByText(/Latest update check failed/)).toBeInTheDocument();
    expect(screen.getByText(/FetchError: HTTP 503/)).toBeInTheDocument();
    expect(screen.getByText('800', { selector: '.kpi__value' })).toBeInTheDocument();
  });

  it('shows source-data notes as "Validated", and errors as a failure', async () => {
    const d = makeDataset(); // the fixture has one validation warning
    const { unmount } = renderAt('#/', d);
    const pill = await screen.findByRole('link', { name: /Validated/ });
    expect(pill).toHaveTextContent(/^✓ Validated$/);
    expect(pill).toHaveAttribute('href', '#/sources');
    unmount();
    renderAt('#/', { ...d, metadata: { ...d.metadata, validation: { ...d.metadata.validation, passed: false } } });
    expect(await screen.findByRole('link', { name: /Validation errors/ })).toBeInTheDocument();
  });

  it('has an about page with contact and citation details that works without the statistics', async () => {
    renderAt('#/about', new Error('stats down'));
    expect(await screen.findByRole('heading', { name: 'About Vision Zero Monitor' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'open an issue on GitHub' })).toHaveAttribute('href', expect.stringMatching(/github\.com\/.+\/issues\/new$/));
    expect(screen.getByText(/not affiliated with, funded by or endorsed by/)).toBeInTheDocument();
    expect(screen.getByText(/built and maintained by Daan Steur/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DaLuSt on GitHub' })).toHaveAttribute('href', 'https://github.com/DaLuSt');
    expect(screen.getByText(/sets no cookies/)).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page');
  });

  it('sorts the country table', async () => {
    const user = userEvent.setup();
    renderAt('#/countries');
    const table = await screen.findByRole('table');
    const names = () => within(table).getAllByRole('rowheader').map((c) => c.textContent);
    expect(names()).toEqual(['Belgium', 'Netherlands', 'Malta']); // rate desc, missing last
    await user.click(within(table).getByRole('button', { name: /^Deaths/ }));
    expect(names()).toEqual(['Belgium', 'Netherlands', 'Malta']);
    await user.click(within(table).getByRole('button', { name: /^Deaths/ }));
    expect(names()).toEqual(['Malta', 'Netherlands', 'Belgium']);
    expect(within(table).getByRole('columnheader', { name: /^Deaths/ })).toHaveAttribute('aria-sort', 'ascending');
    await user.click(within(table).getByRole('button', { name: /Change since 2019/ }));
    expect(names()[0]).toBe('Malta'); // +20% largest, descending first
  });

  it('warns about mixed reference years and missing countries', async () => {
    renderAt('#/countries');
    expect(await screen.findByText(/different reference years \(2022, 2023\)/)).toBeInTheDocument();
  });

  it('selects a country and shows its detail', async () => {
    const user = userEvent.setup();
    renderAt('#/countries/NL');
    expect(await screen.findByRole('heading', { name: 'Netherlands', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Road deaths, Netherlands' })).toBeInTheDocument();
    expect(screen.getByText(/gaps in 2020, 2021/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Member State'), 'BE');
    expect(window.location.hash).toBe('#/countries/BE');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Belgium', level: 2 })).toBeInTheDocument());
  });

  it('handles an unknown country code', async () => {
    renderAt('#/countries/XX');
    expect(await screen.findByText(/not an EU Member State code/)).toBeInTheDocument();
  });

  it('filters the data explorer and exports the filtered rows as CSV', async () => {
    const user = userEvent.setup();
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => { blobs.push(b); return 'blob:x'; });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderAt('#/explorer');
    expect(await screen.findByText(/17 observation\(s\)/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Geography'), 'NL');
    expect(screen.getByText(/5 observation\(s\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(click).toHaveBeenCalled();
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsText(blobs[0]);
    });
    expect(text.trim().split('\r\n')).toHaveLength(6);
    expect(text).toContain('NL,Netherlands,2023,road_fatalities,80');
    click.mockRestore();
  });

  it('links to the sources and methodology', async () => {
    renderAt('#/sources');
    const link = await screen.findByRole('link', { name: 'View source' });
    expect(link).toHaveAttribute('href', expect.stringContaining('ec.europa.eu/eurostat'));
    expect(screen.getByRole('link', { name: 'API request' })).toHaveAttribute('href', expect.stringContaining('/api/dissemination/'));
    expect(screen.getByRole('heading', { name: 'Data quality notes (1)' })).toBeInTheDocument();
    expect(screen.getByText(/2023: no data for MT/)).toBeInTheDocument();
    act(() => { window.location.hash = '#/methodology'; window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(await screen.findByRole('heading', { name: 'Methodology' })).toBeInTheDocument();
  });

  it('has a navigation menu toggle for small screens', async () => {
    const user = userEvent.setup();
    renderAt('#/countries');
    await screen.findByRole('table');
    const toggle = screen.getByRole('button', { name: /menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Countries' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', expect.stringContaining('github.com'));
  });
});

describe('loadDataset', () => {
  it('loads all files and tolerates a missing pipeline status', async () => {
    const d = makeDataset();
    const files: Record<string, unknown> = {
      'observations.json': { observations: d.observations },
      'countries.json': { countries: d.countries },
      'indicators.json': { indicators: d.indicators },
      'metadata.json': d.metadata,
    };
    const fetchImpl = vi.fn(async (url: string) => {
      const name = url.split('/').pop()!;
      return name in files
        ? new Response(JSON.stringify(files[name]), { status: 200 })
        : new Response('not found', { status: 404 });
    }) as unknown as typeof fetch;
    const loaded = await loadDataset(fetchImpl);
    expect(loaded.observations).toHaveLength(d.observations.length);
    expect(loaded.pipelineStatus).toBeNull();
  });

  it('fails clearly when a required file is missing', async () => {
    const fetchImpl = vi.fn(async () => new Response('x', { status: 404 })) as unknown as typeof fetch;
    await expect(loadDataset(fetchImpl)).rejects.toThrow(/HTTP 404/);
  });
});
