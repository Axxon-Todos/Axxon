'use client'

import type { AnalyticsCategoryMetric } from '@/lib/types/boardAnalyticsTypes';

export default function AnalyticsCategoryBreakdown({ categories }: { categories: AnalyticsCategoryMetric[] }) {
  if (!categories.length) {
    return (
      <div className="glass-panel flex h-full items-center justify-center rounded-[1.35rem] p-6 text-sm app-text-muted">
        No workflow categories available.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {categories.map((category) => (
        <article key={category.category_id} className="glass-panel rounded-[1.2rem] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                <p className="truncate text-sm font-semibold">{category.name}</p>
              </div>
              <p className="mt-1 text-xs app-text-muted">
                {category.completed_todos} completed • {category.active_todos} active
              </p>
            </div>
            <span className="app-badge">{category.completion_rate}%</span>
          </div>
        </article>
      ))}
    </div>
  );
}
