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
  await new Promise((r) => setTimeout(r, 0));
  return render(<App load={() => Promise.resolve(data)} />);
}

afterEach(() => { window.location.hash = ''; vi.clearAllMocks(); });

describe('Road users page', () => {
  it('shows both breakdowns for the EU with the coverage note', async () => {
    await renderAt('#/road-users');
    expect(await screen.findByRole('heading', { name: 'Who dies on the roads' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'By road user' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'By mode of transport' })).toBeInTheDocument();
    expect(screen.getAllByText(/EU figures start in 2019/)).toHaveLength(2);
    const section = screen.getByRole('region', { name: 'By mode of transport' });
    const row = within(section).getByRole('rowheader', { name: /Cyclists/ }).closest('tr')!;
    expect(row).toHaveTextContent('160');
    expect(row).toHaveTextContent('20.0%'); // 160 / 800
    expect(row).toHaveTextContent('−20.0%'); // vs 200 in 2019
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Road users' })).toHaveAttribute('aria-current', 'page');
  });

  it('switches geography and keeps the URL shareable', async () => {
    const user = userEvent.setup();
    await renderAt('#/road-users');
    await user.selectOptions(await screen.findByLabelText('Geography'), 'NL');
    expect(window.location.hash).toBe('#/road-users?geo=NL');
    expect(screen.queryByText(/EU figures start/)).not.toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'By mode of transport' });
    expect(within(section).getByRole('rowheader', { name: /Cyclists/ }).closest('tr')).toHaveTextContent('45.0%');
  });

  it('warns when many deaths have an unknown category, and about older latest years', async () => {
    await renderAt('#/road-users?geo=MT');
    expect(await screen.findByText(/33.3% of road deaths in Malta in 2022 are recorded as “unknown”/)).toBeInTheDocument();
    expect(screen.getAllByText(/latest year with a complete breakdown for Malta is 2022/)).toHaveLength(2);
  });

  it('links each category to a cross-country comparison', async () => {
    await renderAt('#/road-users?geo=NL');
    const section = await screen.findByRole('region', { name: 'By road user' });
    expect(within(section).getByRole('link', { name: /Compare pedestrians across countries/ }))
      .toHaveAttribute('href', '#/charts?geo=EU27_2020,NL&cat=road_user.PED&measure=rate');
  });

  it('switches the trend measure', async () => {
    const user = userEvent.setup();
    await renderAt('#/road-users?geo=NL');
    const section = await screen.findByRole('region', { name: 'By road user' });
    await user.click(within(section).getByRole('button', { name: 'Share of deaths' }));
    const fig = within(section).getAllByRole('figure').at(-1)!;
    expect(fig.querySelector('.chart__subtitle')).toHaveTextContent('Share of road deaths (%), 2019–2023');
  });

  it('downloads a CSV of the breakdown', async () => {
    const user = userEvent.setup();
    await renderAt('#/road-users?geo=NL');
    const section = await screen.findByRole('region', { name: 'By road user' });
    await user.click(within(section).getByRole('button', { name: /^CSV of deaths by road user/ }));
    const [csv, name] = vi.mocked(exportChart.downloadText).mock.calls[0];
    expect(name).toBe('road-deaths-by-road-user-netherlands.csv');
    expect(csv).toContain('NL,Netherlands,road_user,PED,Pedestrians,2023,9,unknown,,eurostat:tran_sf_roadus');
  });

  it('degrades gracefully without breakdowns', async () => {
    await renderAt('#/road-users', { ...makeDataset(), breakdowns: null });
    expect(await screen.findByText(/Breakdowns could not be loaded/)).toBeInTheDocument();
  });
});

describe('Chart builder with a breakdown category', () => {
  it('compares one category across countries', async () => {
    const user = userEvent.setup();
    await renderAt('#/charts?geo=EU27_2020,NL');
    await user.selectOptions(await screen.findByLabelText('Who'), 'vehicle.CYCLE');
    expect(window.location.hash).toContain('cat=vehicle.CYCLE');
    const fig = screen.getByRole('figure', { name: /Cyclists killed: 2 geographies compared/ });
    expect(fig.querySelector('.chart__subtitle')).toHaveTextContent('Cyclists killed, 2018–2023');
    expect(screen.getByText(/EU figures for cyclists start in 2019/)).toBeInTheDocument();
  });

  it('hides the selector when breakdowns are unavailable', async () => {
    await renderAt('#/charts', { ...makeDataset(), breakdowns: null });
    await screen.findByRole('heading', { name: 'Chart builder' });
    expect(screen.queryByLabelText('Who')).not.toBeInTheDocument();
  });
});
