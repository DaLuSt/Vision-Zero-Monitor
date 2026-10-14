/**
 * Export a rendered Recharts SVG as a standalone image with title, legend and source.
 *
 * The on-screen chart uses CSS custom properties (var(--series-1) …) that do not
 * resolve outside the page, so computed colours and fonts are copied onto a clone.
 */

export interface LegendEntry {
  label: string;
  color: string;
  dashed?: boolean;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  legend: LegendEntry[];
  source: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const STYLE_PROPS = [
  'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'fill-opacity',
  'opacity', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline',
];

function inlineStyles(source: Element, target: Element): void {
  const cs = getComputedStyle(source);
  const decl: string[] = [];
  for (const prop of STYLE_PROPS) {
    const v = cs.getPropertyValue(prop);
    if (v) decl.push(`${prop}:${v}`);
  }
  if (decl.length) target.setAttribute('style', decl.join(';'));
  // Presentation attributes may still hold unresolved var(); computed style wins.
  for (const attr of ['fill', 'stroke']) {
    const a = target.getAttribute(attr);
    if (a && a.includes('var(')) target.removeAttribute(attr);
  }
  const s = source.children;
  const t = target.children;
  for (let i = 0; i < s.length && i < t.length; i++) inlineStyles(s[i], t[i]);
}

function text(x: number, y: number, content: string, attrs: Record<string, string>): SVGTextElement {
  const el = document.createElementNS(SVG_NS, 'text');
  el.setAttribute('x', String(x));
  el.setAttribute('y', String(y));
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.textContent = content;
  return el;
}

/** Build a self-contained SVG document string for the chart. Pure DOM; testable without canvas. */
export function buildExportSvg(chartSvg: SVGSVGElement, opts: ExportOptions): { svg: string; width: number; height: number } {
  const root = getComputedStyle(document.documentElement);
  const surface = root.getPropertyValue('--surface').trim() || '#ffffff';
  const ink = root.getPropertyValue('--text').trim() || '#0b0b0b';
  const muted = root.getPropertyValue('--text-secondary').trim() || '#52514e';
  const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';

  const box = chartSvg.getBoundingClientRect();
  const chartW = Math.round(box.width || Number(chartSvg.getAttribute('width')) || 800);
  const chartH = Math.round(box.height || Number(chartSvg.getAttribute('height')) || 400);
  const pad = 24;
  // Wide enough for the chart and for the title, subtitle and source lines (approximate glyph widths).
  const textW = Math.max(opts.title.length * 9.6, (opts.subtitle?.length ?? 0) * 7.2, opts.source.length * 6.4);
  const width = Math.ceil(Math.max(chartW, textW) + pad * 2);

  // Legend rows, wrapped to the available width.
  const legendItems: { x: number; y: number; e: LegendEntry }[] = [];
  let lx = pad;
  let ly = 0;
  for (const e of opts.legend) {
    const w = 34 + e.label.length * 7.2;
    if (lx + w > width - pad && lx > pad) { lx = pad; ly += 22; }
    legendItems.push({ x: lx, y: ly, e });
    lx += w + 16;
  }
  const titleH = opts.subtitle ? 60 : 42;
  const legendH = opts.legend.length ? ly + 30 : 0;
  const height = titleH + chartH + legendH + 34;

  const out = document.createElementNS(SVG_NS, 'svg');
  out.setAttribute('xmlns', SVG_NS);
  out.setAttribute('width', String(width));
  out.setAttribute('height', String(height));
  out.setAttribute('viewBox', `0 0 ${width} ${height}`);
  out.setAttribute('font-family', font);

  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('width', String(width));
  bg.setAttribute('height', String(height));
  bg.setAttribute('fill', surface);
  out.appendChild(bg);

  out.appendChild(text(pad, 30, opts.title, { 'font-size': '17', 'font-weight': '600', fill: ink }));
  if (opts.subtitle) out.appendChild(text(pad, 50, opts.subtitle, { 'font-size': '13', fill: muted }));

  const clone = chartSvg.cloneNode(true) as SVGSVGElement;
  inlineStyles(chartSvg, clone);
  clone.setAttribute('x', String(pad));
  clone.setAttribute('y', String(titleH));
  clone.setAttribute('width', String(chartW));
  clone.setAttribute('height', String(chartH));
  out.appendChild(clone);

  const legendTop = titleH + chartH + 16;
  for (const { x, y, e } of legendItems) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(x));
    line.setAttribute('x2', String(x + 22));
    line.setAttribute('y1', String(legendTop + y));
    line.setAttribute('y2', String(legendTop + y));
    line.setAttribute('stroke', e.color);
    line.setAttribute('stroke-width', '2.5');
    if (e.dashed) line.setAttribute('stroke-dasharray', '6 4');
    out.appendChild(line);
    out.appendChild(text(x + 30, legendTop + y + 4, e.label, { 'font-size': '12', fill: ink }));
  }
  out.appendChild(text(pad, height - 12, opts.source, { 'font-size': '11', fill: muted }));

  return { svg: new XMLSerializer().serializeToString(out), width, height };
}

/** Resolve a CSS colour expression such as "var(--cat-1)" to a concrete colour. */
export function resolveColor(expr: string): string {
  const m = expr.match(/^var\((--[\w-]+)\)$/);
  if (!m) return expr;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#2a78d6';
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Render the export SVG onto a 2× canvas and download it as PNG. */
export async function downloadChartPng(chartSvg: SVGSVGElement, opts: ExportOptions, filename: string): Promise<void> {
  const { svg, width, height } = buildExportSvg(chartSvg, opts);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render the chart image.'));
      img.src = svgUrl;
    });
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not create the PNG file.');
    triggerDownload(blob, filename);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function downloadText(content: string, filename: string, type = 'text/csv;charset=utf-8'): void {
  triggerDownload(new Blob([content], { type }), filename);
}

export function slug(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
