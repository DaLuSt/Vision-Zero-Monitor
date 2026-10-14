import { CSV_COLUMNS, toCsv } from './csv';
import { obs } from '../test/fixtures';

describe('CSV export', () => {
  it('writes a header and one line per observation', () => {
    const csv = toCsv([obs('NL', 'road_fatalities', '2023', 80), obs('MT', 'road_fatalities', '2023', null)]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe(CSV_COLUMNS.join(','));
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('NL,Netherlands,2023,road_fatalities,80,persons,unknown');
    // Missing values are empty, never zero.
    expect(lines[2]).toContain('MT,Malta,2023,road_fatalities,,persons,missing');
  });

  it('quotes commas and quotes, and neutralises formulas', () => {
    const o = { ...obs('NL', 'road_fatalities', '2023', 1), geo_name: 'Name, with "quote"', status_note: undefined };
    const bad = { ...obs('NL', 'road_fatalities', '2023', 1), geo_name: '=HYPERLINK("x")' };
    const csv = toCsv([o, bad]);
    expect(csv).toContain('"Name, with ""quote"""');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
