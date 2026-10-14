import type { ReactNode } from 'react';

export function LoadingState() {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" /> Loading official statistics…
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="state state--error" role="alert">
      <h2>Data could not be loaded</h2>
      <p>{message}</p>
      <p>
        No figures are shown rather than potentially incorrect ones. Please try again later or consult the original
        source at{' '}
        <a href="https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadus/default/table">Eurostat</a>.
      </p>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="state state--empty">{children}</div>;
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <div className={`notice notice--${tone}`} role="note">
      <span className="notice__icon" aria-hidden="true">{tone === 'warning' ? '⚠' : 'ℹ'}</span>
      <div>{children}</div>
    </div>
  );
}
