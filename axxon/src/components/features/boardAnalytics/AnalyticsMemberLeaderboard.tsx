'use client'

import type { AnalyticsMemberMetric } from '@/lib/types/boardAnalyticsTypes';

type AnalyticsMemberLeaderboardProps = {
  members: AnalyticsMemberMetric[];
};

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

export default function AnalyticsMemberLeaderboard({ members }: AnalyticsMemberLeaderboardProps) {
  if (!members.length) {
    return (
      <div className="glass-panel flex h-full items-center justify-center rounded-[1.3rem] p-6 text-sm app-text-muted">
        No assigned work yet for this filter.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {members.slice(0, 8).map((member, index) => (
        <article key={member.user_id} className="glass-panel rounded-[1.2rem] p-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold app-text-muted">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--analytics-accent, var(--app-accent)) 14%, transparent)',
                color: 'var(--analytics-accent, var(--app-accent))',
              }}
            >
              {initials(member.first_name, member.last_name)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {member.first_name} {member.last_name}
              </p>
              <p className="text-xs app-text-muted">{member.assigned_total_todos} assigned</p>
            </div>

            <span className="app-badge">{member.completion_rate}%</span>
          </div>

          <div className="mt-3 rounded-full border border-[var(--app-border)] bg-[var(--app-panel)] p-1">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.max(member.completion_rate, member.assigned_total_todos > 0 ? 6 : 0)}%`,
                background: 'var(--analytics-accent, var(--app-accent))',
              }}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs app-text-muted">
            <span className="app-badge">{member.assigned_completed_todos} completed</span>
            <span className="app-badge">{member.assigned_active_todos} active</span>
          </div>
        </article>
      ))}
    </div>
  );
}
