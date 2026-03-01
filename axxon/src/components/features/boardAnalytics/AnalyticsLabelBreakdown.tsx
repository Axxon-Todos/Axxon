'use client'

import ChartLegend from '@/components/ui/charts/ChartLegend';
import type { AnalyticsLabelMetric } from '@/lib/types/boardAnalyticsTypes';

export default function AnalyticsLabelBreakdown({ labels }: { labels: AnalyticsLabelMetric[] }) {
  if (!labels.length) {
    return (
      <div className="glass-panel flex h-full items-center justify-center rounded-[1.35rem] p-6 text-sm app-text-muted">
        No labels attached to todos yet.
      </div>
    );
  }

  return (
    <ChartLegend
      items={labels.slice(0, 6).map((label) => ({
        id: label.label_id,
        label: label.name,
        color: label.color,
        value: `${label.completed_todos} complete`,
      }))}
    />
  );
}
