import { useState } from 'react';
import type { Dataset } from '../types/data';
import type { Route } from '../lib/router';
import { fmtDate } from '../lib/format';
import { REPO_URL } from '../lib/site';

const NAV: { href: string; label: string; pages: Route['page'][] }[] = [
  { href: '#/', label: 'Overview', pages: ['overview'] },
  { href: '#/countries', label: 'Countries', pages: ['countries', 'country'] },
  { href: '#/road-users', label: 'Road users', pages: ['road-users'] },
  { href: '#/charts', label: 'Chart builder', pages: ['charts'] },
  { href: '#/explorer', label: 'Data explorer', pages: ['explorer'] },
  { href: '#/methodology', label: 'Methodology', pages: ['methodology'] },
  { href: '#/sources', label: 'Sources & freshness', pages: ['sources'] },
];

export function latestRetrieval(data: Dataset | null): string | null {
  if (!data) return null;
  const times = data.metadata.sources.map((s) => s.retrieved_at).filter(Boolean).sort();
  return times.length ? times[times.length - 1] : null;
}

function StatusIndicator({ data }: { data: Dataset | null }) {
  if (!data) return null;
  const ps = data.pipelineStatus;
  const warnings = data.metadata.validation.warnings.length;
  let label: string;
  let tone: 'ok' | 'warn' | 'fail';
  if (ps?.last_outcome === 'failure') {
    tone = 'fail';
    label = 'Latest update check failed – showing last valid data';
  } else if (!data.metadata.validation.passed) {
    tone = 'fail';
    label = 'Validation errors';
  } else if (warnings) {
    tone = 'warn';
    label = `Validated with ${warnings} warning${warnings === 1 ? '' : 's'}`;
  } else {
    tone = 'ok';
    label = 'Validated';
  }
  const icon = tone === 'ok' ? '✓' : tone === 'warn' ? '!' : '✕';
  return (
    <a className={`status-pill status-pill--${tone}`} href="#/sources">
      <span aria-hidden="true">{icon}</span> {label}
    </a>
  );
}

export function Header({ route, data }: { route: Route; data: Dataset | null }) {
  const [open, setOpen] = useState(false);
  const refreshed = latestRetrieval(data);
  const period = data?.metadata.coverage.period;
  return (
    <header className="site-header">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <div className="site-header__inner">
        <div className="brand">
          <p className="brand__eyebrow">Independent public-interest data</p>
          <h1 className="brand__title"><a href="#/">Vision Zero Monitor</a></h1>
          <p className="brand__mission">
            Open-source platform monitoring Europe's road safety progress, legislation, policy commitments, and progress
            towards Vision Zero.
          </p>
        </div>
        {data && (
          <dl className="header-meta">
            <div><dt>Data retrieved</dt><dd>{fmtDate(refreshed)}</dd></div>
            <div><dt>Latest reference year</dt><dd>{period ?? 'Not available'}</dd></div>
            <div><dt>Data status</dt><dd><StatusIndicator data={data} /></dd></div>
          </dl>
        )}
      </div>
      <nav className="site-nav" aria-label="Main">
        <div className="site-nav__inner">
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls="nav-list"
            onClick={() => setOpen((o) => !o)}
          >
            <span aria-hidden="true">☰</span> Menu
          </button>
          <ul id="nav-list" className={`nav-list${open ? ' nav-list--open' : ''}`}>
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} aria-current={n.pages.includes(route.page) ? 'page' : undefined} onClick={() => setOpen(false)}>
                  {n.label}
                </a>
              </li>
            ))}
            <li>
              <a href={REPO_URL} rel="noopener noreferrer">GitHub<span className="visually-hidden"> repository (external)</span></a>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}
