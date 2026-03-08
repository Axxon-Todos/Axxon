'use client'

import type { AnalyticsLabelMetric } from '@/lib/types/boardAnalyticsTypes';

export default function AnalyticsLabelBreakdown({ labels }: { labels: AnalyticsLabelMetric[] }) {
  if (!labels.length) {
    return (
      <div className="glass-panel flex h-full items-center justify-center rounded-[1.3rem] p-6 text-sm app-text-muted">
        No labels attached to todos for this filter.
      </div>
    );
  }

  return (
    <div className="grid gap-2.5">
      {labels.slice(0, 8).map((label) => (
        <article key={label.label_id} className="glass-panel rounded-[1.1rem] px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: label.color }} />
              <p className="truncate text-sm font-medium">{label.name}</p>
            </div>
            <span className="text-xs font-semibold app-text-muted">{label.completion_rate}%</span>
          </div>
          <p className="mt-1 text-xs app-text-muted">
            {label.total_todos} total • {label.completed_todos} completed • {label.active_todos} active
          </p>
        </article>
      ))}
    </div>
  );
}
