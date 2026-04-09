// Summarizes label performance as compact signal cards beside the treemap view.
'use client';

import Badge from '@/components/ui/Badge';
import type { AnalyticsLabelMetric } from '@/lib/types/boardAnalyticsTypes';

import AnalyticsEmptyState from './AnalyticsEmptyState';

type ScopeMode = 'all' | 'completed' | 'active';

function scopeValue(label: AnalyticsLabelMetric, scope: ScopeMode) {
  if (scope === 'completed') return label.completed_todos;
  if (scope === 'active') return label.active_todos;
  return label.total_todos;
}

export default function AnalyticsLabelBreakdown({
  labels,
  scope,
}: {
  labels: AnalyticsLabelMetric[];
  scope: ScopeMode;
}) {
  if (!labels.length) {
    return <AnalyticsEmptyState label="No labels attached to todos for this filter." className="min-h-[320px]" />;
  }

  return (
    <div className="grid gap-3">
      {labels.slice(0, 8).map((label, index) => {
        const focusValue = scopeValue(label, scope);

        return (
          <article
            key={label.label_id}
            className="rounded-[1.2rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_82%,transparent)] px-4 py-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[var(--app-border)] text-[0.72rem] font-semibold app-text-muted">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: label.color }} />
                  <p className="truncate text-sm font-semibold">{label.name}</p>
                </div>
                <p className="mt-2 text-xs leading-5 app-text-muted">
                  {label.total_todos} total, {label.completed_todos} completed, {label.active_todos} active
                </p>
              </div>
              <Badge>{label.completion_rate}% done</Badge>
            </div>

            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--app-border)_80%,transparent)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(label.completion_rate, label.total_todos > 0 ? 6 : 0)}%`,
                  backgroundColor: label.color,
                }}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs app-text-muted">
              <span className="app-badge">{focusValue} in focus</span>
              <span className="app-badge">{label.by_category.length} categories touched</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
