// Presents concise analytics callouts with consistent visual tone and icon treatment.
'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

type AnalyticsInsightTone = 'accent' | 'success' | 'warning' | 'neutral';

const toneStyles: Record<AnalyticsInsightTone, { panel: string; icon: string; text: string }> = {
  accent: {
    panel:
      'border-[color:color-mix(in_srgb,var(--analytics-accent,var(--app-accent))_22%,var(--app-border))] bg-[color:color-mix(in_srgb,var(--analytics-accent,var(--app-accent))_10%,var(--app-panel-strong))]',
    icon:
      'bg-[color:color-mix(in_srgb,var(--analytics-accent,var(--app-accent))_16%,transparent)] text-[var(--analytics-accent,var(--app-accent))]',
    text: 'text-[var(--analytics-accent,var(--app-accent))]',
  },
  success: {
    panel:
      'border-[color:color-mix(in_srgb,var(--app-success)_22%,var(--app-border))] bg-[color:color-mix(in_srgb,var(--app-success)_10%,var(--app-panel-strong))]',
    icon:
      'bg-[color:color-mix(in_srgb,var(--app-success)_16%,transparent)] text-[var(--app-success)]',
    text: 'text-[var(--app-success)]',
  },
  warning: {
    panel:
      'border-[color:color-mix(in_srgb,var(--app-warning)_24%,var(--app-border))] bg-[color:color-mix(in_srgb,var(--app-warning)_10%,var(--app-panel-strong))]',
    icon:
      'bg-[color:color-mix(in_srgb,var(--app-warning)_16%,transparent)] text-[var(--app-warning)]',
    text: 'text-[var(--app-warning)]',
  },
  neutral: {
    panel:
      'border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_82%,transparent)]',
    icon:
      'bg-[color:color-mix(in_srgb,var(--app-muted)_16%,transparent)] text-[var(--app-muted-strong)]',
    text: 'text-[var(--app-foreground-strong)]',
  },
};

export default function AnalyticsInsightCard({
  icon: Icon,
  title,
  value,
  detail,
  tone = 'neutral',
  className,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  detail: string;
  tone?: AnalyticsInsightTone;
  className?: string;
}) {
  const styles = toneStyles[tone];

  return (
    <article
      className={cn(
        'rounded-[1.35rem] border p-4 shadow-[0_18px_44px_-30px_rgba(2,6,23,0.72)]',
        styles.panel,
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] app-text-muted">
            {title}
          </p>
          <p className={cn('mt-3 text-lg font-semibold leading-tight', styles.text)}>{value}</p>
        </div>
        <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', styles.icon)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 app-text-muted">{detail}</p>
    </article>
  );
}
