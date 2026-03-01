'use client'

import { CheckCircle2, LayoutGrid, ListTodo, UserRoundX } from 'lucide-react';
import type { BoardAnalyticsSummary } from '@/lib/types/boardAnalyticsTypes';

const cards = [
  { key: 'total_todos', label: 'Tracked Todos', icon: ListTodo },
  { key: 'completed_todos', label: 'Completed', icon: CheckCircle2 },
  { key: 'category_count', label: 'Categories', icon: LayoutGrid },
  { key: 'unassigned_todos', label: 'Unassigned', icon: UserRoundX },
] as const;

export default function AnalyticsSummaryCards({ summary }: { summary: BoardAnalyticsSummary }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = summary[card.key];

        return (
          <article key={card.key} className="glass-panel rounded-[1.35rem] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium app-text-muted">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
              </div>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ background: 'color-mix(in srgb, var(--app-accent) 14%, transparent)' }}
              >
                <Icon className="h-5 w-5 text-[var(--app-accent)]" />
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
