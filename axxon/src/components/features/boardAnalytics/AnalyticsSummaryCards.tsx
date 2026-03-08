'use client'

import { CheckCircle2, ListTodo, TimerReset, UserRoundX } from 'lucide-react';

import type { BoardAnalyticsSummary } from '@/lib/types/boardAnalyticsTypes';

const cards = [
  { key: 'total_todos', label: 'Tracked Todos', icon: ListTodo },
  { key: 'completed_todos', label: 'Completed', icon: CheckCircle2 },
  { key: 'active_todos', label: 'Active', icon: TimerReset },
  { key: 'unassigned_todos', label: 'Unassigned', icon: UserRoundX },
] as const;

function ratio(value: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

export default function AnalyticsSummaryCards({ summary }: { summary: BoardAnalyticsSummary }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = summary[card.key];

        return (
          <article key={card.key} className="glass-panel rounded-[1.4rem] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium app-text-muted">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
                <p className="mt-2 text-xs app-text-muted">
                  {card.key === 'total_todos'
                    ? `${summary.completion_rate}% board completion`
                    : `${ratio(value, summary.total_todos)} of tracked todos`}
                </p>
              </div>
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: 'color-mix(in srgb, var(--analytics-accent, var(--app-accent)) 14%, transparent)' }}
              >
                <Icon className="h-5 w-5" style={{ color: 'var(--analytics-accent, var(--app-accent))' }} />
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
