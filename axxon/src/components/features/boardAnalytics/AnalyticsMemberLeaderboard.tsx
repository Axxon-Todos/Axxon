// Highlights top contributors with richer ranking cards and workload context.
'use client';

import Badge from '@/components/ui/Badge';
import type { AnalyticsMemberMetric } from '@/lib/types/boardAnalyticsTypes';

import AnalyticsEmptyState from './AnalyticsEmptyState';

type ScopeMode = 'all' | 'completed' | 'active';

type AnalyticsMemberLeaderboardProps = {
  members: AnalyticsMemberMetric[];
  scope: ScopeMode;
};

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

function scopeLabel(scope: ScopeMode) {
  if (scope === 'completed') return 'completed';
  if (scope === 'active') return 'active';
  return 'tracked';
}

function scopeValue(member: AnalyticsMemberMetric, scope: ScopeMode) {
  if (scope === 'completed') return member.assigned_completed_todos;
  if (scope === 'active') return member.assigned_active_todos;
  return member.assigned_total_todos;
}

export default function AnalyticsMemberLeaderboard({
  members,
  scope,
}: AnalyticsMemberLeaderboardProps) {
  if (!members.length) {
    return <AnalyticsEmptyState label="No assigned work yet for this filter." className="min-h-[320px]" />;
  }

  const visibleMembers = members.slice(0, 6);

  return (
    <div className="grid gap-3">
      {visibleMembers.map((member, index) => {
        const currentScopeValue = scopeValue(member, scope);

        return (
          <article
            key={member.user_id}
            className="rounded-[1.25rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_82%,transparent)] p-4"
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] text-[0.72rem] font-semibold app-text-muted">
                {String(index + 1).padStart(2, '0')}
              </span>

              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold"
                style={{
                  background:
                    'color-mix(in srgb, var(--analytics-accent, var(--app-accent)) 14%, transparent)',
                  color: 'var(--analytics-accent, var(--app-accent))',
                }}
              >
                {initials(member.first_name, member.last_name)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="mt-1 text-xs app-text-muted">
                      {member.assigned_total_todos} assigned total
                    </p>
                  </div>
                  <Badge>{member.completion_rate}% completion</Badge>
                </div>

                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--app-border)_80%,transparent)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(member.completion_rate, member.assigned_total_todos > 0 ? 6 : 0)}%`,
                      background: 'var(--analytics-accent, var(--app-accent))',
                    }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs app-text-muted">
                  <span className="app-badge">{currentScopeValue} {scopeLabel(scope)}</span>
                  <span className="app-badge">{member.assigned_completed_todos} completed</span>
                  <span className="app-badge">{member.assigned_active_todos} active</span>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
