import type { Status } from '../types/data';
import { STATUS_DESCRIPTION, STATUS_LABEL } from '../lib/format';

const ICON: Record<Status, string> = {
  final: '●',
  unknown: '○',
  provisional: '◇',
  estimated: '◇',
  missing: '–',
};

/** Status is conveyed by text and symbol, never colour alone. */
export function StatusBadge({ status, flag, compact = false }: { status: Status; flag?: string | null; compact?: boolean }) {
  const label = STATUS_LABEL[status];
  const title = `${STATUS_DESCRIPTION[status]}${flag ? ` Eurostat flag: “${flag}”.` : ''}`;
  return (
    <span className={`badge badge--${status}`} title={title}>
      <span aria-hidden="true">{ICON[status]}</span> {compact ? label.replace('No status flag', 'No flag') : label}
      {flag ? <span className="badge__flag"> ({flag})</span> : null}
    </span>
  );
}
