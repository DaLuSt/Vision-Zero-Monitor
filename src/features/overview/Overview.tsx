import type { Dataset } from '../../types/data';
import { Notice } from '../../components/States';
import { KpiCards } from './KpiCards';
import { FreshnessPanel } from './FreshnessPanel';
import { EuTrend } from '../trends/EuTrend';

export function Overview({ data }: { data: Dataset }) {
  return (
    <>
      <Notice>{data.metadata.frequency_notice}</Notice>
      <KpiCards data={data} />
      <EuTrend data={data} />
      <FreshnessPanel data={data} />
    </>
  );
}
