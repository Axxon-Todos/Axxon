// Renders high-signal KPI cards for the board analytics executive overview.
'use client';

import {
  CheckCircle2,
  FolderKanban,
  ListTodo,
  TimerReset,
  UserRoundX,
} from 'lucide-react';

import type { BoardAnalyticsSummary } from '@/lib/types/boardAnalyticsTypes';

const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact' });

const cards = [
  {
    key: 'total_todos',
    label: 'Tracked Todos',
    icon: ListTodo,
    tone: 'accent',
  },
  {
    key: 'completed_todos',
    label: 'Completed',
    icon: CheckCircle2,
    tone: 'success',
  },
  {
    key: 'active_todos',
    label: 'Active',
    icon: TimerReset,
    tone: 'neutral',
  },
  {
    key: 'unassigned_todos',
    label: 'Unassigned',
    icon: UserRoundX,
    tone: 'warning',
  },
] as const;

function ratio(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function toneStyles(tone: (typeof cards)[number]['tone']) {
  if (tone === 'accent') {
    return {
      panel:
        'border-[color:color-mix(in_srgb,var(--analytics-accent,var(--app-accent))_24%,var(--app-border))] bg-[color:color-mix(in_srgb,var(--analytics-accent,var(--app-accent))_10%,var(--app-panel-strong))]',
      icon:
        'bg-[color:color-mix(in_srgb,var(--analytics-accent,var(--app-accent))_16%,transparent)] text-[var(--analytics-accent,var(--app-accent))]',
      bar: 'var(--analytics-accent, var(--app-accent))',
    };
  }

  if (tone === 'success') {
    return {
      panel:
        'border-[color:color-mix(in_srgb,var(--app-success)_22%,var(--app-border))] bg-[color:color-mix(in_srgb,var(--app-success)_10%,var(--app-panel-strong))]',
      icon:
        'bg-[color:color-mix(in_srgb,var(--app-success)_16%,transparent)] text-[var(--app-success)]',
      bar: 'var(--app-success)',
    };
  }

  if (tone === 'warning') {
    return {
      panel:
        'border-[color:color-mix(in_srgb,var(--app-warning)_24%,var(--app-border))] bg-[color:color-mix(in_srgb,var(--app-warning)_10%,var(--app-panel-strong))]',
      icon:
        'bg-[color:color-mix(in_srgb,var(--app-warning)_16%,transparent)] text-[var(--app-warning)]',
      bar: 'var(--app-warning)',
    };
  }

  return {
    panel:
      'border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_82%,transparent)]',
    icon:
      'bg-[color:color-mix(in_srgb,var(--app-highlight)_14%,transparent)] text-[var(--app-highlight)]',
    bar: 'var(--app-highlight)',
  };
}

export default function AnalyticsSummaryCards({
  summary,
  selectedCategoryName,
}: {
  summary: BoardAnalyticsSummary;
  selectedCategoryName: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = summary[card.key];
        const styles = toneStyles(card.tone);
        const percentage =
          card.key === 'total_todos'
            ? summary.completion_rate
            : ratio(value, summary.total_todos);

        return (
          <article
            key={card.key}
            className={`overflow-hidden rounded-[1.55rem] border p-5 shadow-[0_22px_54px_-34px_rgba(2,6,23,0.78)] ${styles.panel}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium app-text-muted">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {value >= 1000 ? compactNumber.format(value) : value}
                </p>
                <p className="mt-2 text-xs leading-5 app-text-muted">
                  {card.key === 'total_todos'
                    ? `${summary.category_count} workflow stages in ${selectedCategoryName.toLowerCase()}.`
                    : `${percentage}% of tracked work in this view.`}
                </p>
              </div>
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${styles.icon}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] app-text-muted">
                <span>Signal</span>
                <span>{percentage}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--app-border)_80%,transparent)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(Math.min(percentage, 100), value > 0 ? 6 : 0)}%`,
                    backgroundColor: styles.bar,
                  }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-xs app-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <FolderKanban className="h-3.5 w-3.5" />
                {summary.active_category_count} active stages
              </span>
              <span>{summary.completed_category_count} done</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
