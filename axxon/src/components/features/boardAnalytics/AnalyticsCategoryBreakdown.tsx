// Breaks workflow categories into ranked, scan-friendly cards beside the main chart.
'use client';

import Badge from '@/components/ui/Badge';
import type { AnalyticsCategoryMetric } from '@/lib/types/boardAnalyticsTypes';

import AnalyticsEmptyState from './AnalyticsEmptyState';

export default function AnalyticsCategoryBreakdown({
  categories,
  totalTodos,
}: {
  categories: AnalyticsCategoryMetric[];
  totalTodos: number;
}) {
  if (!categories.length) {
    return <AnalyticsEmptyState label="No workflow categories available for this filter." className="min-h-[320px]" />;
  }

  return (
    <div className="grid gap-3">
      {categories.map((category, index) => {
        const share = totalTodos > 0 ? Math.round((category.total_todos / totalTodos) * 100) : 0;

        return (
          <article
            key={category.category_id}
            className="rounded-[1.25rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_82%,transparent)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[var(--app-border)] text-[0.72rem] font-semibold app-text-muted">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                  <p className="truncate text-sm font-semibold">{category.name}</p>
                </div>
                <p className="mt-2 text-xs leading-5 app-text-muted">
                  {category.total_todos} total, {category.completed_todos} completed, {category.active_todos} active
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Badge>{category.completion_rate}% done</Badge>
                <Badge className="!text-[0.68rem]">{share}% of scope</Badge>
              </div>
            </div>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--app-border)_80%,transparent)]">
              <div className="flex h-full">
                <span
                  style={{
                    width: `${category.completion_rate}%`,
                    backgroundColor: category.color,
                  }}
                />
                <span
                  style={{
                    width: `${Math.max(100 - category.completion_rate, 0)}%`,
                    backgroundColor: 'color-mix(in srgb, var(--app-highlight) 68%, transparent)',
                  }}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs app-text-muted">
              <span className="app-badge">{category.is_done ? 'Done stage' : 'Active stage'}</span>
              <span className="app-badge">{category.position + 1} in workflow order</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
