import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import App from '../../App';
import { DATA_FILES } from './DataFiles';

afterEach(() => { window.location.hash = ''; });

describe('Open data page', () => {
  it('describes every published data file and its schema', () => {
    const published = readdirSync(resolve(__dirname, '../../../public/data')).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).sort();
    expect(DATA_FILES.map((f) => f.name).sort()).toEqual(published);
    const schemas = readdirSync(resolve(__dirname, '../../../schemas'));
    for (const f of DATA_FILES) expect(schemas).toContain(`${f.name}.schema.json`);
  });

  it('lists downloads and works without the statistics', async () => {
    window.location.hash = '#/data';
    await new Promise((r) => setTimeout(r, 0));
    render(<App load={() => Promise.reject(new Error('down'))} />);
    expect(await screen.findByRole('heading', { name: 'Open data files' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Published data files' });
    const link = within(table).getByRole('link', { name: 'observations.json' });
    expect(link).toHaveAttribute('href', expect.stringMatching(/data\/observations\.json$/));
    expect(link).toHaveAttribute('download');
    expect(screen.getByText(/never zero/)).toBeInTheDocument();
  });
});
