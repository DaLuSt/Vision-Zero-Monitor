import { buildExportSvg, resolveColor, slug } from './exportChart';

function chartSvg(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '600');
  svg.setAttribute('height', '300');
  svg.setAttribute('class', 'recharts-surface');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M0,0 L10,10');
  path.setAttribute('stroke', 'var(--cat-1)');
  svg.appendChild(path);
  document.body.appendChild(svg);
  return svg;
}

describe('buildExportSvg', () => {
  beforeEach(() => {
    document.documentElement.style.setProperty('--cat-1', '#2a78d6');
    document.documentElement.style.setProperty('--surface', '#fcfcfb');
  });

  it('wraps the chart with title, subtitle, legend and source', () => {
    const { svg, width, height } = buildExportSvg(chartSvg(), {
      title: 'Road deaths: 2 geographies compared',
      subtitle: 'Road deaths per million inhabitants, 2010–2024',
      legend: [{ label: 'EU total', color: '#2a78d6' }, { label: 'Netherlands', color: '#eb6834' }],
      source: 'Source: Eurostat',
    });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Road deaths: 2 geographies compared');
    expect(svg).toContain('per million inhabitants');
    expect(svg).toContain('>EU total<');
    expect(svg).toContain('>Netherlands<');
    expect(svg).toContain('Source: Eurostat');
    expect(svg).toContain('fill="#fcfcfb"'); // opaque background
    expect(width).toBeGreaterThanOrEqual(600);
    expect(height).toBeGreaterThan(300);
  });

  it('is wide enough for a long source line on a small chart', () => {
    const small = chartSvg();
    small.setAttribute('width', '300');
    const source = 'Source: Eurostat (tran_sf_roadus, demo_gind) · Vision Zero Monitor';
    const { width } = buildExportSvg(small, { title: 't', legend: [], source });
    expect(width).toBeGreaterThanOrEqual(source.length * 6.4 + 48);
  });

  it('removes unresolvable CSS variables from the cloned chart', () => {
    const { svg } = buildExportSvg(chartSvg(), { title: 't', legend: [], source: 's' });
    expect(svg).not.toContain('stroke="var(');
  });

  it('escapes text content', () => {
    const { svg } = buildExportSvg(chartSvg(), { title: '<b>x</b> & y', legend: [], source: 's' });
    expect(svg).toContain('&lt;b&gt;x&lt;/b&gt; &amp; y');
  });
});

describe('helpers', () => {
  it('resolveColor reads CSS variables', () => {
    document.documentElement.style.setProperty('--cat-2', '#eb6834');
    expect(resolveColor('var(--cat-2)')).toBe('#eb6834');
    expect(resolveColor('#123456')).toBe('#123456');
  });
  it('slug makes safe file names', () => {
    expect(slug('Road deaths: EU total / Netherlands — 2010–2024')).toBe('road-deaths-eu-total-netherlands-2010-2024');
  });
});
