// Renders a shared empty-state surface for analytics charts and supporting rails.
'use client';

import { BarChart3 } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

export default function AnalyticsEmptyState({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'glass-panel flex h-full min-h-[220px] flex-col items-center justify-center rounded-[1.35rem] px-6 py-8 text-center',
        className
      )}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          background:
            'color-mix(in srgb, var(--analytics-accent, var(--app-accent)) 16%, transparent)',
          color: 'var(--analytics-accent, var(--app-accent))',
        }}
      >
        <BarChart3 className="h-5 w-5" />
      </span>
      <p className="mt-4 max-w-sm text-sm leading-6 app-text-muted">{label}</p>
    </div>
  );
}
