// Renders board analytics with the shared hero language, tokenized filters, and refreshed data sections.
'use client'

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Filter,
  Layers3,
  Tags,
  Users2,
} from 'lucide-react';

import Badge from '@/components/ui/Badge';
import { buttonClassName } from '@/components/ui/Button';
import PageHero from '@/components/ui/PageHero';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Surface from '@/components/ui/Surface';
import { fetchBoardAnalytics } from '@/lib/api/boards/getBoardAnalytics';
import { useOrganizationRouteParams } from '@/hooks/useOrganizationRouteParams';
import {
  buildOrganizationBoardPath,
} from '@/lib/utils/routes';

import AnalyticsCategoryBarChart from './AnalyticsCategoryBarChart';
import AnalyticsCategoryBreakdown from './AnalyticsCategoryBreakdown';
import AnalyticsCompletionDonut from './AnalyticsCompletionDonut';
import AnalyticsLabelBarChart from './AnalyticsLabelBarChart';
import AnalyticsLabelBreakdown from './AnalyticsLabelBreakdown';
import AnalyticsMemberLeaderboard from './AnalyticsMemberLeaderboard';
import AnalyticsSummaryCards from './AnalyticsSummaryCards';

import type {
  AnalyticsCategoryMetric,
  AnalyticsLabelMetric,
  AnalyticsMemberMetric,
  BoardAnalyticsData,
} from '@/lib/types/boardAnalyticsTypes';

type ScopeMode = 'all' | 'completed' | 'active';
type SectionId = 'overview' | 'workflow' | 'members' | 'labels';

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

function formatGeneratedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return 'Unavailable';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

const SECTION_NAV: Array<{ value: SectionId; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'members', label: 'Members' },
  { value: 'labels', label: 'Labels' },
];

export default function BoardAnalyticsView({ boardId }: { boardId: string }) {
  const { organizationId } = useOrganizationRouteParams();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [scope, setScope] = useState<ScopeMode>('completed');
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  const deferredCategoryId = useDeferredValue(selectedCategoryId);
  const deferredScope = useDeferredValue(scope);

  const { data, isLoading, isError } = useQuery<BoardAnalyticsData>({
    queryKey: ['board-analytics', organizationId, boardId],
    queryFn: () => fetchBoardAnalytics(organizationId, boardId),
  });

  useEffect(() => {
    const sections = SECTION_NAV
      .map((section) => document.getElementById(section.value))
      .filter((section): section is HTMLElement => section !== null);

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const topSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (!topSection?.target?.id) return;

        const sectionId = topSection.target.id as SectionId;
        setActiveSection((current) => (current === sectionId ? current : sectionId));
      },
      { threshold: [0.2, 0.45, 0.7], rootMargin: '-30% 0px -55% 0px' }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const filtered = useMemo(() => {
    if (!data) {
      return {
        categories: [] as AnalyticsCategoryMetric[],
        members: [] as AnalyticsMemberMetric[],
        labels: [] as AnalyticsLabelMetric[],
      };
    }

    const orderedCategories = data.categories.slice().sort((left, right) => left.position - right.position);

    const categories =
      deferredCategoryId === 'all'
        ? orderedCategories
        : orderedCategories.filter((category) => category.category_id === deferredCategoryId);

    const members = data.members
      .map((member) => {
        if (deferredCategoryId === 'all') return member;

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
        if (deferredCategoryId === 'all') return label;

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

  const completionItems = useMemo(() => {
    if (!data) return [];

    const sourceCategories =
      deferredCategoryId === 'all'
        ? data.categories
        : data.categories.filter((category) => category.category_id === deferredCategoryId);

    const completed = sourceCategories.reduce((sum, category) => sum + category.completed_todos, 0);
    const active = sourceCategories.reduce((sum, category) => sum + category.active_todos, 0);

    return [
      {
        id: 'completed',
        label: 'Completed',
        value: completed,
        color: 'var(--analytics-accent, var(--app-accent))',
        description: 'Marked complete and currently in done workflow stages.',
      },
      {
        id: 'active',
        label: 'Active',
        value: active,
        color: 'var(--app-muted)',
        description: 'Todos still in backlog or in-progress stages.',
      },
    ];
  }, [data, deferredCategoryId]);

  const categoryBarItems = useMemo(() => {
    return filtered.categories.map((category) => ({
      id: category.category_id,
      label: category.name,
      color: category.color,
      total: category.total_todos,
      completed: category.completed_todos,
      active: category.active_todos,
    }));
  }, [filtered.categories]);

  const labelBarItems = useMemo(() => {
    return filtered.labels.slice(0, 6).map((label) => ({
      id: label.label_id,
      label: label.name,
      color: label.color,
      total: label.total_todos,
      completed: label.completed_todos,
      active: label.active_todos,
      completionRate: label.completion_rate,
    }));
  }, [filtered.labels]);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-[1560px] flex-col gap-4">
        <Surface variant="strong" className="rounded-[2rem] p-6">
          <div className="h-4 w-36 rounded-full bg-[var(--app-border)]" />
          <div className="mt-4 h-10 w-72 rounded-2xl bg-[var(--app-border)]" />
          <div className="mt-3 h-4 w-full max-w-xl rounded-full bg-[var(--app-border)]" />
        </Surface>

        <Surface variant="strong" className="rounded-[1.4rem] p-4">
          <div className="h-10 w-full rounded-xl bg-[var(--app-border)]" />
        </Surface>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Surface key={index} className="h-32 rounded-[1.4rem]" />
              ))}
            </div>
            <Surface variant="strong" className="h-[320px] rounded-[1.6rem]" />
          </div>
          <div className="grid gap-4">
            <Surface variant="strong" className="h-[320px] rounded-[1.6rem]" />
            <Surface variant="strong" className="h-[300px] rounded-[1.6rem]" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-[1560px]">
        <Surface variant="strong" className="rounded-[2rem] p-8">
          <p className="app-kicker">Board Analytics</p>
          <h1 className="mt-3 text-3xl font-semibold">Unable to load analytics</h1>
          <p className="mt-3 text-sm app-text-muted">
            Refresh and try again. If this continues, return to the board and re-open analytics.
          </p>
          <Link
            href={buildOrganizationBoardPath(organizationId, boardId)}
            className={buttonClassName({ className: 'mt-6' })}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Board
          </Link>
        </Surface>
      </div>
    );
  }

  const completionRate = `${data.summary.completion_rate}%`;
  const selectedCategoryName =
    deferredCategoryId === 'all'
      ? 'All Categories'
      : data.categories.find((category) => category.category_id === deferredCategoryId)?.name ?? 'Selected Category';
  const generatedAt = formatGeneratedAt(data.generated_at);
  const analyticsStyles = { ['--analytics-accent' as string]: data.board.color || 'var(--app-accent)' };

  return (
    <div style={analyticsStyles} className="mx-auto flex max-w-[1560px] flex-col gap-4">
      <PageHero
        kicker="Board Analytics"
        title={data.board.name}
        description="Analytics across workflow stages, member throughput, and label adoption. Completion only counts when a todo is marked complete and currently in a done category."
        accentColor={data.board.color || '#2fd087'}
        actions={
          <Link
            href={buildOrganizationBoardPath(organizationId, boardId)}
            className={buttonClassName({})}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Board
          </Link>
        }
        badges={
          <>
            <Badge>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {completionRate} completion
            </Badge>
            <Badge>
              <Layers3 className="h-3.5 w-3.5" />
              {data.summary.category_count} categories
            </Badge>
            <Badge>
              <Clock3 className="h-3.5 w-3.5" />
              Updated {generatedAt}
            </Badge>
          </>
        }
      />

      <Surface variant="strong" className="sticky top-3 z-20 rounded-[1.35rem] p-3 sm:p-4">
        <SegmentedControl
          value={activeSection}
          onChange={(section) => {
            setActiveSection(section);
            document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          options={SECTION_NAV}
          ariaLabel="Analytics sections"
          className="w-full"
        />

        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.1fr)]">
          <label className="app-select-shell flex items-center gap-2 px-3 py-2">
            <Filter className="h-4 w-4 app-text-muted" />
            <span className="sr-only">Filter by category</span>
            <select
              value={deferredCategoryId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedCategoryId(value === 'all' ? 'all' : Number(value));
              }}
              className="w-full bg-transparent text-sm font-medium outline-none"
            >
              <option value="all">All Categories</option>
              {data.categories
                .slice()
                .sort((left, right) => left.position - right.position)
                .map((category) => (
                  <option key={category.category_id} value={category.category_id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>

          <SegmentedControl
            value={deferredScope}
            onChange={setScope}
            options={[
              { value: 'completed', label: 'Completed' },
              { value: 'active', label: 'Active' },
              { value: 'all', label: 'All' },
            ]}
            ariaLabel="Analytics scope"
          />
        </div>
      </Surface>

      <section id="overview" className="scroll-mt-28">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="app-kicker">Overview</p>
            <h2 className="mt-1 text-2xl font-semibold">{selectedCategoryName}</h2>
          </div>
          <CheckCircle2 className="h-5 w-5 text-[var(--analytics-accent)]" />
        </div>

        <div className="grid gap-4">
          <AnalyticsSummaryCards summary={data.summary} />
          <Surface variant="strong" className="rounded-[1.6rem] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="app-kicker">Progress Split</p>
                <h3 className="mt-1 text-xl font-semibold">Completed vs Active</h3>
              </div>
              <BarChart3 className="h-5 w-5 text-[var(--analytics-accent)]" />
            </div>
            <div className="mt-4 min-h-[280px]">
              <AnalyticsCompletionDonut
                items={completionItems}
                centerLabel="Completion"
                centerValue={completionRate}
                emptyLabel="No todos to chart yet for this filter."
              />
            </div>
          </Surface>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-28">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="app-kicker">Workflow</p>
            <h2 className="mt-1 text-2xl font-semibold">Category Performance</h2>
          </div>
          <Layers3 className="h-5 w-5 text-[var(--analytics-accent)]" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <Surface variant="strong" className="rounded-[1.6rem] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold capitalize">{deferredScope} workload by category</h3>
              <Badge>{selectedCategoryName}</Badge>
            </div>
            <div className="mt-4 min-h-[320px]">
              <AnalyticsCategoryBarChart
                items={categoryBarItems}
                scope={deferredScope}
                emptyLabel="No todos in this workflow scope yet."
              />
            </div>
          </Surface>

          <Surface variant="strong" className="rounded-[1.6rem] p-4 sm:p-5">
            <h3 className="text-lg font-semibold">Workflow Detail</h3>
            <div className="mt-4">
              <AnalyticsCategoryBreakdown categories={filtered.categories} />
            </div>
          </Surface>
        </div>
      </section>

      <section id="members" className="scroll-mt-28">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="app-kicker">Members</p>
            <h2 className="mt-1 text-2xl font-semibold">Team Throughput</h2>
          </div>
          <Users2 className="h-5 w-5 text-[var(--analytics-accent)]" />
        </div>

        <Surface variant="strong" className="rounded-[1.6rem] p-4 sm:p-5">
          <AnalyticsMemberLeaderboard members={filtered.members} />
        </Surface>
      </section>

      <section id="labels" className="scroll-mt-28">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="app-kicker">Labels</p>
            <h2 className="mt-1 text-2xl font-semibold">Label Adoption</h2>
          </div>
          <Tags className="h-5 w-5 text-[var(--analytics-accent)]" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <Surface variant="strong" className="rounded-[1.6rem] p-4 sm:p-5">
            <h3 className="text-lg font-semibold">Top labels by {deferredScope}</h3>
            <div className="mt-4 min-h-[300px]">
              <AnalyticsLabelBarChart
                items={labelBarItems}
                scope={deferredScope}
                emptyLabel="No label activity yet for this filter."
              />
            </div>
          </Surface>

          <Surface variant="strong" className="rounded-[1.6rem] p-4 sm:p-5">
            <h3 className="text-lg font-semibold">Label Breakdown</h3>
            <div className="mt-4">
              <AnalyticsLabelBreakdown labels={filtered.labels} />
            </div>
          </Surface>
        </div>
      </section>
    </div>
  );
}
