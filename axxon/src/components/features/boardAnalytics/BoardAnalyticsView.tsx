'use client'

import Link from 'next/link';
import { useMemo, useState, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, CheckCircle2, Filter, PieChart, Tags, Users2 } from 'lucide-react';

import { fetchBoardAnalytics } from '@/lib/api/boards/getBoardAnalytics';

import AnalyticsBarChart from '@/components/ui/charts/AnalyticsBarChart';
import AnalyticsDonutChart from '@/components/ui/charts/AnalyticsDonutChart';
import AnalyticsPieChart from '@/components/ui/charts/AnalyticsPieChart';
import AnalyticsSummaryCards from './AnalyticsSummaryCards';
import AnalyticsMemberLeaderboard from './AnalyticsMemberLeaderboard';
import AnalyticsLabelBreakdown from './AnalyticsLabelBreakdown';
import AnalyticsCategoryBreakdown from './AnalyticsCategoryBreakdown';

import type {
  AnalyticsCategoryMetric,
  AnalyticsLabelMetric,
  AnalyticsMemberMetric,
  BoardAnalyticsData,
} from '@/lib/types/boardAnalyticsTypes';

type ScopeMode = 'all' | 'completed' | 'active';
type MobileTab = 'overview' | 'workflow' | 'members' | 'labels';

function categoryMetricForScope(category: AnalyticsCategoryMetric, scope: ScopeMode) {
  if (scope === 'completed') return category.completed_todos;
  if (scope === 'active') return category.active_todos;
  return category.total_todos;
}

function labelMetricForScope(label: AnalyticsLabelMetric, scope: ScopeMode) {
  if (scope === 'completed') return label.completed_todos;
  if (scope === 'active') return label.active_todos;
  return label.total_todos;
}

function memberMetricForScope(member: AnalyticsMemberMetric, scope: ScopeMode) {
  if (scope === 'completed') return member.assigned_completed_todos;
  if (scope === 'active') return member.assigned_active_todos;
  return member.assigned_total_todos;
}

export default function BoardAnalyticsView({ boardId }: { boardId: string }) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [scope, setScope] = useState<ScopeMode>('completed');
  const [mobileTab, setMobileTab] = useState<MobileTab>('overview');

  const deferredCategoryId = useDeferredValue(selectedCategoryId);
  const deferredScope = useDeferredValue(scope);

  const { data, isLoading } = useQuery<BoardAnalyticsData>({
    queryKey: ['board-analytics', boardId],
    queryFn: () => fetchBoardAnalytics(boardId),
  });

  const filtered = useMemo(() => {
    if (!data) {
      return {
        categories: [] as AnalyticsCategoryMetric[],
        members: [] as AnalyticsMemberMetric[],
        labels: [] as AnalyticsLabelMetric[],
      };
    }

    const categories =
      deferredCategoryId === 'all'
        ? data.categories
        : data.categories.filter((category) => category.category_id === deferredCategoryId);

    const members = data.members
      .map((member) => {
        if (deferredCategoryId === 'all') {
          return member;
        }

        const scoped = member.by_category.find((entry) => entry.category_id === deferredCategoryId);
        const scopedTotal = scoped?.total_todos ?? 0;
        const scopedCompleted = scoped?.completed_todos ?? 0;

        return {
          ...member,
          assigned_total_todos: scopedTotal,
          assigned_completed_todos: scopedCompleted,
          assigned_active_todos: Math.max(scopedTotal - scopedCompleted, 0),
          completion_rate: scopedTotal > 0 ? Number(((scopedCompleted / scopedTotal) * 100).toFixed(1)) : 0,
          by_category: scoped ? [scoped] : [],
        };
      })
      .sort((left, right) => memberMetricForScope(right, deferredScope) - memberMetricForScope(left, deferredScope))
      .filter((member) => memberMetricForScope(member, deferredScope) > 0 || deferredCategoryId === 'all');

    const labels = data.labels
      .map((label) => {
        if (deferredCategoryId === 'all') {
          return label;
        }

        const scoped = label.by_category.find((entry) => entry.category_id === deferredCategoryId);
        const scopedTotal = scoped?.total_todos ?? 0;
        const scopedCompleted = scoped?.completed_todos ?? 0;

        return {
          ...label,
          total_todos: scopedTotal,
          completed_todos: scopedCompleted,
          active_todos: Math.max(scopedTotal - scopedCompleted, 0),
          completion_rate: scopedTotal > 0 ? Number(((scopedCompleted / scopedTotal) * 100).toFixed(1)) : 0,
          by_category: scoped ? [scoped] : [],
        };
      })
      .sort((left, right) => labelMetricForScope(right, deferredScope) - labelMetricForScope(left, deferredScope))
      .filter((label) => labelMetricForScope(label, deferredScope) > 0 || deferredCategoryId === 'all');

    return { categories, members, labels };
  }, [data, deferredCategoryId, deferredScope]);

  const donutItems = useMemo(() => {
    if (!data) return [];

    const sourceCategories = deferredCategoryId === 'all'
      ? data.categories
      : data.categories.filter((category) => category.category_id === deferredCategoryId);

    const completed = sourceCategories.reduce((sum, category) => sum + category.completed_todos, 0);
    const active = sourceCategories.reduce((sum, category) => sum + category.active_todos, 0);

    return [
      {
        id: 'completed',
        label: 'Completed',
        value: completed,
        color: 'var(--app-accent)',
        description: 'Todos that are marked complete and currently sit in a done category.',
      },
      {
        id: 'active',
        label: 'Active',
        value: active,
        color: '#94a3b8',
        description: 'Todos still moving through backlog or active workflow categories.',
      },
    ];
  }, [data, deferredCategoryId]);

  const categoryBarItems = useMemo(() => {
    return filtered.categories.map((category) => ({
      id: category.category_id,
      label: category.name,
      value: categoryMetricForScope(category, deferredScope),
      secondaryValue: category.total_todos,
      color: category.color,
      meta:
        deferredScope === 'completed'
          ? `${category.completed_todos} complete`
          : deferredScope === 'active'
            ? `${category.active_todos} active`
            : `${category.completed_todos} complete • ${category.active_todos} active`,
    }));
  }, [filtered.categories, deferredScope]);

  const labelPieItems = useMemo(() => {
    return filtered.labels.slice(0, 5).map((label) => ({
      id: label.label_id,
      label: label.name,
      value: labelMetricForScope(label, deferredScope),
      color: label.color,
      description:
        deferredScope === 'completed'
          ? `${label.completed_todos} completed todos use this label.`
          : deferredScope === 'active'
            ? `${label.active_todos} active todos use this label.`
            : `${label.total_todos} todos use this label.`,
    }));
  }, [filtered.labels, deferredScope]);

  const selectedCategoryName = deferredCategoryId === 'all'
    ? 'All Categories'
    : data?.categories.find((category) => category.category_id === deferredCategoryId)?.name ?? 'Selected Category';

  if (isLoading || !data) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <section className="glass-panel-strong flex h-full items-center justify-center rounded-[2rem] p-8">
          <div>
            <p className="app-kicker">Board Analytics</p>
            <h1 className="mt-3 text-3xl font-semibold">Loading analytics...</h1>
          </div>
        </section>
      </div>
    );
  }

  const completionRate = `${data.summary.completion_rate}%`;
  const labelCenterValue = `${filtered.labels.length} labels`;

  return (
    <div className="flex h-full min-h-0 max-w-full flex-col gap-4 overflow-x-hidden overflow-y-hidden">
      <section
        className="glass-panel-strong rounded-[2rem] p-5 sm:p-6"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${data.board.color || '#2563eb'} 15%, var(--app-panel-strong)), var(--app-panel-strong))`,
        }}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="app-kicker">Board Analytics</p>
            <div className="mt-3 flex items-center gap-3">
              <span
                className="h-4 w-4 rounded-full"
                style={{
                  backgroundColor: data.board.color || 'var(--app-accent)',
                  boxShadow: `0 0 0 8px color-mix(in srgb, ${data.board.color || '#2563eb'} 18%, transparent)`,
                }}
              />
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{data.board.name}</h1>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 app-text-muted">
              Interactive board analytics across categories, labels, and member throughput. Completion only counts
              when a todo is marked complete and sits inside a done category.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/dashboard/${boardId}`} className="glass-button">
              <ArrowLeft className="h-4 w-4" />
              Back to Board
            </Link>
            <span className="app-badge">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {completionRate} completion
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`glass-button px-4 py-2 text-sm ${deferredCategoryId === 'all' ? 'glass-button-primary' : ''}`}
          >
            <Filter className="h-4 w-4" />
            All Categories
          </button>
          {data.categories.map((category) => (
            <button
              key={category.category_id}
              type="button"
              onClick={() => setSelectedCategoryId(category.category_id)}
              className={`glass-button px-4 py-2 text-sm ${deferredCategoryId === category.category_id ? 'glass-button-primary' : ''}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
              {category.name}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(['completed', 'active', 'all'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setScope(mode)}
              className={`glass-button px-4 py-2 text-sm capitalize ${deferredScope === mode ? 'glass-button-primary' : ''}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </section>

      <div className="hidden min-h-0 min-w-0 flex-1 gap-4 xl:grid xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <AnalyticsSummaryCards summary={data.summary} />

          <div className="grid min-h-0 min-w-0 flex-1 gap-4 2xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
            <section className="glass-panel-strong flex min-h-0 min-w-0 flex-col rounded-[1.75rem] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="app-kicker">Workflow</p>
                  <h2 className="mt-2 text-xl font-semibold">{selectedCategoryName}</h2>
                </div>
                <BarChart3 className="h-5 w-5 text-[var(--app-accent)]" />
              </div>
              <div className="mt-5 min-h-0 flex-1 overflow-auto pr-1">
                <AnalyticsBarChart
                  items={categoryBarItems}
                  emptyLabel="No todos in this workflow scope yet."
                />
              </div>
            </section>

            <section className="glass-panel-strong flex min-h-0 min-w-0 flex-col rounded-[1.75rem] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="app-kicker">Progress Split</p>
                  <h2 className="mt-2 text-xl font-semibold">Complete vs Active</h2>
                </div>
                <PieChart className="h-5 w-5 text-[var(--app-accent)]" />
              </div>
              <div className="mt-5 min-h-0 flex-1">
                <AnalyticsDonutChart
                  items={donutItems}
                  centerLabel="Completion"
                  centerValue={completionRate}
                  emptyLabel="No todos to chart yet."
                />
              </div>
            </section>
          </div>
        </div>

        <div className="grid min-h-0 min-w-0 gap-4">
          <section className="glass-panel-strong flex min-h-0 min-w-0 flex-col rounded-[1.75rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="app-kicker">Members</p>
                <h2 className="mt-2 text-xl font-semibold">Top Closers</h2>
              </div>
              <Users2 className="h-5 w-5 text-[var(--app-accent)]" />
            </div>
            <div className="mt-5 min-h-0 flex-1 overflow-auto pr-1">
              <AnalyticsMemberLeaderboard members={filtered.members} />
            </div>
          </section>

          <section className="glass-panel-strong flex min-h-0 min-w-0 flex-col rounded-[1.75rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="app-kicker">Labels</p>
                <h2 className="mt-2 text-xl font-semibold">Most Completed</h2>
              </div>
              <Tags className="h-5 w-5 text-[var(--app-accent)]" />
            </div>
            <div className="mt-5 grid min-h-0 min-w-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_200px]">
              <AnalyticsPieChart
                items={labelPieItems}
                centerLabel="Top Labels"
                centerValue={labelCenterValue}
                emptyLabel="No label activity yet."
              />
              <div className="min-h-0 overflow-auto pr-1">
                <AnalyticsLabelBreakdown labels={filtered.labels} />
              </div>
            </div>
          </section>

          <section className="glass-panel-strong min-h-0 min-w-0 overflow-auto rounded-[1.75rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="app-kicker">Category Detail</p>
                <h2 className="mt-2 text-xl font-semibold">Workflow Breakdown</h2>
              </div>
              <BarChart3 className="h-5 w-5 text-[var(--app-accent)]" />
            </div>
            <div className="mt-5">
              <AnalyticsCategoryBreakdown categories={filtered.categories} />
            </div>
          </section>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 xl:hidden">
        <div className="grid grid-cols-4 gap-2">
          {([
            ['overview', 'Overview'],
            ['workflow', 'Workflow'],
            ['members', 'Members'],
            ['labels', 'Labels'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobileTab(id)}
              className={`glass-button px-3 py-2 text-xs ${mobileTab === id ? 'glass-button-primary' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <section className="glass-panel-strong min-h-0 flex-1 overflow-auto rounded-[1.75rem] p-4">
          {mobileTab === 'overview' ? (
            <div className="grid gap-4">
              <AnalyticsSummaryCards summary={data.summary} />
              <AnalyticsDonutChart
                items={donutItems}
                centerLabel="Completion"
                centerValue={completionRate}
                emptyLabel="No todos to chart yet."
              />
            </div>
          ) : null}

          {mobileTab === 'workflow' ? (
            <div className="grid gap-4">
              <AnalyticsBarChart items={categoryBarItems} emptyLabel="No todos in this workflow scope yet." />
              <AnalyticsCategoryBreakdown categories={filtered.categories} />
            </div>
          ) : null}

          {mobileTab === 'members' ? <AnalyticsMemberLeaderboard members={filtered.members} /> : null}

          {mobileTab === 'labels' ? (
            <div className="grid gap-4">
              <AnalyticsPieChart
                items={labelPieItems}
                centerLabel="Top Labels"
                centerValue={labelCenterValue}
                emptyLabel="No label activity yet."
              />
              <AnalyticsLabelBreakdown labels={filtered.labels} />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
