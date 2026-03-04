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
      <div className="glass-panel flex h-full items-center justify-center rounded-[1.35rem] p-6 text-sm app-text-muted">
        No assigned work yet.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {members.slice(0, 6).map((member, index) => (
        <article key={member.user_id} className="glass-panel rounded-[1.2rem] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-xs font-semibold app-text-muted">{String(index + 1).padStart(2, '0')}</span>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold text-[var(--app-accent)]"
                style={{
                  background: member.avatar_url
                    ? `linear-gradient(135deg, color-mix(in srgb, ${member.avatar_url ? 'var(--app-accent)' : '#cbd5e1'} 12%, transparent), color-mix(in srgb, var(--app-panel-strong) 94%, white 6%))`
                    : 'color-mix(in srgb, var(--app-accent) 16%, transparent)',
                }}
              >
                {initials(member.first_name, member.last_name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{member.first_name} {member.last_name}</p>
                <p className="truncate text-xs app-text-muted">
                  {member.assigned_completed_todos} completed • {member.completion_rate}% rate
                </p>
              </div>
            </div>
            <div className="text-right text-xs app-text-muted">
              <p>{member.assigned_total_todos} assigned</p>
              <p>{member.assigned_active_todos} active</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
