// Renders the board analytics page as an executive cockpit with immersive charts and derived insights.
'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Filter,
  Layers3,
  Sparkles,
  Tags,
  Target,
  Trophy,
  Users2,
} from 'lucide-react';

import Badge from '@/components/ui/Badge';
import { buttonClassName } from '@/components/ui/Button';
import PageHero from '@/components/ui/PageHero';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Surface from '@/components/ui/Surface';
import { fetchBoardAnalytics } from '@/lib/api/boards/getBoardAnalytics';
import { useOrganizationRouteParams } from '@/hooks/useOrganizationRouteParams';
import { resolveAccentColor } from '@/lib/utils/brandColors';
import { buildOrganizationBoardPath } from '@/lib/utils/routes';

import AnalyticsCategoryBarChart from './AnalyticsCategoryBarChart';
import AnalyticsCategoryBreakdown from './AnalyticsCategoryBreakdown';
import AnalyticsCompletionDonut from './AnalyticsCompletionDonut';
import AnalyticsInsightCard from './AnalyticsInsightCard';
import AnalyticsLabelBreakdown from './AnalyticsLabelBreakdown';
import AnalyticsLabelTreemap, { type AnalyticsLabelTreemapItem } from './AnalyticsLabelTreemap';
import AnalyticsMemberLeaderboard from './AnalyticsMemberLeaderboard';
import AnalyticsMemberScatterChart, {
  type AnalyticsMemberScatterItem,
} from './AnalyticsMemberScatterChart';
import AnalyticsSummaryCards from './AnalyticsSummaryCards';

import type {
  AnalyticsCategoryMetric,
  AnalyticsLabelMetric,
  AnalyticsMemberMetric,
  BoardAnalyticsData,
  BoardAnalyticsSummary,
} from '@/lib/types/boardAnalyticsTypes';

type ScopeMode = 'all' | 'completed' | 'active';
type SectionId = 'overview' | 'workflow' | 'members' | 'labels';
type DerivedSummary = BoardAnalyticsSummary & { assignment_rate: number };

const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact' });
const SECTION_EASE = [0.16, 1, 0.3, 1] as const;

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

function scopeLabel(scope: ScopeMode) {
  if (scope === 'completed') return 'Completed';
  if (scope === 'active') return 'Active';
  return 'All work';
}

function scopeDescription(scope: ScopeMode) {
  if (scope === 'completed') return 'completed throughput';
  if (scope === 'active') return 'active workload';
  return 'full board load';
}

function memberInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

function toRate(numerator: number, denominator: number) {
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;
}

function buildFilteredSummary({
  data,
  categories,
  selectedCategoryId,
}: {
  data: BoardAnalyticsData;
  categories: AnalyticsCategoryMetric[];
  selectedCategoryId: number | 'all';
}): DerivedSummary {
  const totalTodos = categories.reduce((sum, category) => sum + category.total_todos, 0);
  const completedTodos = categories.reduce((sum, category) => sum + category.completed_todos, 0);
  const categoryCount = categories.length;
  const completedCategoryCount = categories.filter((category) => category.is_done).length;

  const unassignedTodos =
    selectedCategoryId === 'all'
      ? data.summary.unassigned_todos
      : Math.max(
          totalTodos -
            data.members.reduce((sum, member) => {
              const scoped = member.by_category.find(
                (entry) => entry.category_id === selectedCategoryId
              );
              return sum + (scoped?.total_todos ?? 0);
            }, 0),
          0
        );

  return {
    total_todos: totalTodos,
    completed_todos: completedTodos,
    active_todos: Math.max(totalTodos - completedTodos, 0),
    unassigned_todos: unassignedTodos,
    completion_rate: toRate(completedTodos, totalTodos),
    category_count: categoryCount,
    completed_category_count: completedCategoryCount,
    active_category_count: Math.max(categoryCount - completedCategoryCount, 0),
    assignment_rate: toRate(Math.max(totalTodos - unassignedTodos, 0), totalTodos),
  };
}

function sectionMotion(shouldReduceMotion: boolean, delay = 0) {
  if (shouldReduceMotion) {
    return {
      initial: false as const,
      whileInView: undefined,
      viewport: undefined,
      transition: { duration: 0 },
    };
  }

  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.16 },
    transition: {
      duration: 0.42,
      delay,
      ease: SECTION_EASE,
    },
  };
}

const SECTION_NAV: Array<{ value: SectionId; label: string; icon: ReactNode }> = [
  { value: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
  { value: 'workflow', label: 'Workflow', icon: <Layers3 className="h-4 w-4" /> },
  { value: 'members', label: 'Members', icon: <Users2 className="h-4 w-4" /> },
  { value: 'labels', label: 'Labels', icon: <Tags className="h-4 w-4" /> },
];

export default function BoardAnalyticsView({ boardId }: { boardId: string }) {
  const { organizationId } = useOrganizationRouteParams();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [scope, setScope] = useState<ScopeMode>('completed');
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  const deferredCategoryId = useDeferredValue(selectedCategoryId);
  const deferredScope = useDeferredValue(scope);

  const { data, isLoading, isError } = useQuery<BoardAnalyticsData>({
    queryKey: ['board-analytics', organizationId, boardId],
    queryFn: () => fetchBoardAnalytics(organizationId, boardId),
    enabled: Boolean(organizationId && boardId),
  });

  useEffect(() => {
    const sections = SECTION_NAV.map((section) => document.getElementById(section.value)).filter(
      (section): section is HTMLElement => section !== null
    );

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
      { threshold: [0.18, 0.42, 0.68], rootMargin: '-28% 0px -55% 0px' }
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

    const orderedCategories = data.categories
      .slice()
      .sort((left, right) => left.position - right.position);

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
          completion_rate: toRate(scopedCompleted, scopedTotal),
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
          completion_rate: toRate(scopedCompleted, scopedTotal),
          by_category: scoped ? [scoped] : [],
        };
      })
      .sort((left, right) => labelMetricForScope(right, deferredScope) - labelMetricForScope(left, deferredScope))
      .filter((label) => labelMetricForScope(label, deferredScope) > 0 || deferredCategoryId === 'all');

    return { categories, members, labels };
  }, [data, deferredCategoryId, deferredScope]);

  const filteredSummary = useMemo(() => {
    if (!data) {
      return null;
    }

    return buildFilteredSummary({
      data,
      categories: filtered.categories,
      selectedCategoryId: deferredCategoryId,
    });
  }, [data, filtered.categories, deferredCategoryId]);

  const completionItems = useMemo(() => {
    if (!filteredSummary) return [];

    return [
      {
        id: 'completed',
        label: 'Completed',
        value: filteredSummary.completed_todos,
        color: 'var(--analytics-accent, var(--app-accent))',
        description: 'Marked complete and currently placed inside a done workflow stage.',
      },
      {
        id: 'active',
        label: 'Active',
        value: filteredSummary.active_todos,
        color: 'var(--app-highlight)',
        description: 'Still moving through backlog or in-progress stages for this view.',
      },
    ];
  }, [filteredSummary]);

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

  const memberScatterItems = useMemo<AnalyticsMemberScatterItem[]>(() => {
    return filtered.members.slice(0, 12).map((member) => ({
      id: member.user_id,
      name: `${member.first_name} ${member.last_name}`,
      initials: memberInitials(member.first_name, member.last_name),
      completionRate: member.completion_rate,
      total: member.assigned_total_todos,
      completed: member.assigned_completed_todos,
      active: member.assigned_active_todos,
      scopeValue: memberMetricForScope(member, deferredScope),
      color: 'var(--analytics-accent, var(--app-accent))',
    }));
  }, [filtered.members, deferredScope]);

  const labelTreemapItems = useMemo<AnalyticsLabelTreemapItem[]>(() => {
    return filtered.labels.slice(0, 8).map((label) => ({
      id: label.label_id,
      name: label.name,
      value: labelMetricForScope(label, deferredScope),
      total: label.total_todos,
      completed: label.completed_todos,
      active: label.active_todos,
      completionRate: label.completion_rate,
      color: label.color,
    }));
  }, [filtered.labels, deferredScope]);

  const selectedCategoryName =
    !data || deferredCategoryId === 'all'
      ? 'All Categories'
      : data.categories.find((category) => category.category_id === deferredCategoryId)?.name ??
        'Selected Category';

  const generatedAt = data ? formatGeneratedAt(data.generated_at) : 'Unavailable';
  const boardAccent = data ? resolveAccentColor(data.board.color) : 'var(--app-accent)';
  const analyticsStyles = { ['--analytics-accent' as string]: boardAccent };

  const operationalInsights = useMemo(() => {
    if (!filteredSummary) return [];

    const bottleneckCategory = filtered.categories
      .filter((category) => category.total_todos > 0)
      .sort((left, right) => right.active_todos - left.active_todos || right.total_todos - left.total_todos)[0];

    const strongestCategory = filtered.categories
      .filter((category) => category.total_todos > 0)
      .sort(
        (left, right) =>
          right.completion_rate - left.completion_rate || right.completed_todos - left.completed_todos
      )[0];

    const topContributor = filtered.members.find(
      (member) => memberMetricForScope(member, deferredScope) > 0
    );
    const topLabel = filtered.labels.find((label) => labelMetricForScope(label, deferredScope) > 0);
    const unassignedRate = Math.round(
      filteredSummary.total_todos > 0
        ? (filteredSummary.unassigned_todos / filteredSummary.total_todos) * 100
        : 0
    );

    return [
      {
        id: 'bottleneck',
        title: 'Workflow bottleneck',
        value: bottleneckCategory ? bottleneckCategory.name : 'No active bottleneck',
        detail: bottleneckCategory
          ? `${bottleneckCategory.active_todos} active todos are still parked in this stage.`
          : 'No active work is piling up in the current filter.',
        tone: bottleneckCategory?.active_todos ? ('warning' as const) : ('neutral' as const),
        icon: AlertTriangle,
      },
      {
        id: 'strongest',
        title: 'Strongest finish rate',
        value: strongestCategory
          ? `${strongestCategory.completion_rate}% in ${strongestCategory.name}`
          : 'No finished stages yet',
        detail: strongestCategory
          ? `${strongestCategory.completed_todos} todos are fully complete in this stage.`
          : 'Completion momentum will appear here once work reaches a done column.',
        tone: strongestCategory?.completion_rate ? ('success' as const) : ('neutral' as const),
        icon: Sparkles,
      },
      {
        id: 'contributor',
        title: 'Top contributor',
        value: topContributor
          ? `${topContributor.first_name} ${topContributor.last_name}`
          : 'No contributor signal',
        detail: topContributor
          ? `${memberMetricForScope(topContributor, deferredScope)} ${scopeDescription(
              deferredScope
            )} items with ${topContributor.completion_rate}% completion.`
          : 'Assign work to surface contributor throughput.',
        tone: topContributor ? ('accent' as const) : ('neutral' as const),
        icon: Trophy,
      },
      {
        id: 'label',
        title: 'Label adoption',
        value: topLabel ? topLabel.name : 'No label signal',
        detail: topLabel
          ? `${labelMetricForScope(topLabel, deferredScope)} ${scopeDescription(
              deferredScope
            )} items are tagged with this label.`
          : 'Add labels to tasks to expose thematic clusters.',
        tone: topLabel ? ('accent' as const) : ('neutral' as const),
        icon: Tags,
      },
      {
        id: 'assignment',
        title: 'Assignment coverage',
        value: `${filteredSummary.assignment_rate}% staffed`,
        detail:
          filteredSummary.unassigned_todos > 0
            ? `${filteredSummary.unassigned_todos} todos are still unassigned, which is ${unassignedRate}% of this view.`
            : 'All visible work is assigned to someone right now.',
        tone:
          filteredSummary.unassigned_todos > 0 ? ('warning' as const) : ('success' as const),
        icon: Target,
      },
    ];
  }, [filtered.categories, filtered.labels, filtered.members, filteredSummary, deferredScope]);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-[1560px] flex-col gap-4">
        <Surface variant="strong" className="rounded-[2rem] p-6">
          <div className="h-4 w-36 rounded-full bg-[var(--app-border)]" />
          <div className="mt-4 h-10 w-72 rounded-2xl bg-[var(--app-border)]" />
          <div className="mt-3 h-4 w-full max-w-xl rounded-full bg-[var(--app-border)]" />
          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.75fr)]">
            <div className="h-[250px] rounded-[1.8rem] bg-[var(--app-border)]" />
            <div className="h-[250px] rounded-[1.8rem] bg-[var(--app-border)]" />
          </div>
        </Surface>

        <Surface variant="strong" className="rounded-[1.5rem] p-4">
          <div className="h-10 w-full rounded-xl bg-[var(--app-border)]" />
        </Surface>

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Surface key={index} className="h-40 rounded-[1.4rem]" />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Surface variant="strong" className="h-[420px] rounded-[1.6rem]" />
          <Surface variant="strong" className="h-[420px] rounded-[1.6rem]" />
        </div>
      </div>
    );
  }

  if (isError || !data || !filteredSummary) {
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

  const completionRate = `${filteredSummary.completion_rate}%`;
  const heroSummary = `${selectedCategoryName} is showing ${compactNumber.format(
    filteredSummary.total_todos
  )} tracked todos with ${filteredSummary.assignment_rate}% assignment coverage and ${filteredSummary.active_todos} active items still moving.`;
  const focusNarrative = `${scopeLabel(deferredScope)} scope is centered on ${selectedCategoryName.toLowerCase()} across workflow, member throughput, and label concentration.`;

  return (
    <div style={analyticsStyles} className="mx-auto flex max-w-[1560px] flex-col gap-4">
      <PageHero
        kicker="Board Analytics"
        title={data.board.name}
        description="Analytics across workflow stages, member throughput, and label adoption. Completion only counts when a todo is marked complete and currently in a done category."
        accentColor={boardAccent}
        actions={
          <Link href={buildOrganizationBoardPath(organizationId, boardId)} className={buttonClassName({})}>
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
              {filteredSummary.category_count} stages in view
            </Badge>
            <Badge>
              <Clock3 className="h-3.5 w-3.5" />
              Updated {generatedAt}
            </Badge>
          </>
        }
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
          <motion.div {...sectionMotion(shouldReduceMotion)}>
            <Surface variant="interactive" className="h-full rounded-[1.85rem] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="app-kicker">Mission Control</p>
                  <h2 className="mt-2 text-[clamp(1.6rem,2.6vw,2.4rem)] font-semibold tracking-tight">
                    Operational focus
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 app-text-muted">{heroSummary}</p>
                </div>
                <Badge className="!px-3 !py-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  {scopeLabel(deferredScope)}
                </Badge>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <article className="rounded-[1.35rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_82%,transparent)] px-4 py-3.5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] app-text-muted">Tracked</p>
                  <p className="mt-2 text-2xl font-semibold">{filteredSummary.total_todos}</p>
                  <p className="mt-1 text-xs leading-5 app-text-muted">Total visible todos across the current cockpit filter.</p>
                </article>
                <article className="rounded-[1.35rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_82%,transparent)] px-4 py-3.5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] app-text-muted">Assigned</p>
                  <p className="mt-2 text-2xl font-semibold">{filteredSummary.assignment_rate}%</p>
                  <p className="mt-1 text-xs leading-5 app-text-muted">Coverage of work that already has an owner attached.</p>
                </article>
                <article className="rounded-[1.35rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_82%,transparent)] px-4 py-3.5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] app-text-muted">Active load</p>
                  <p className="mt-2 text-2xl font-semibold">{filteredSummary.active_todos}</p>
                  <p className="mt-1 text-xs leading-5 app-text-muted">Open work still moving through non-done workflow stages.</p>
                </article>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Badge>
                  <Filter className="h-3.5 w-3.5" />
                  {selectedCategoryName}
                </Badge>
                <Badge>
                  <BarChart3 className="h-3.5 w-3.5" />
                  {scopeLabel(deferredScope)}
                </Badge>
                <Badge>
                  <Users2 className="h-3.5 w-3.5" />
                  {filtered.members.length} contributors visible
                </Badge>
                <Badge>
                  <Tags className="h-3.5 w-3.5" />
                  {filtered.labels.length} labels in signal
                </Badge>
              </div>

              <p className="mt-5 text-sm leading-7 app-text-muted">{focusNarrative}</p>
            </Surface>
          </motion.div>

          <motion.div {...sectionMotion(shouldReduceMotion, 0.06)}>
            <Surface variant="strong" className="h-full rounded-[1.85rem] p-5 sm:p-6">
              <p className="app-kicker">Completion Spotlight</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Execution pulse</h2>
                  <p className="mt-2 max-w-xs text-sm leading-7 app-text-muted">
                    The ring tracks how much visible work is truly complete versus still active.
                  </p>
                </div>
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{
                    background:
                      'color-mix(in srgb, var(--analytics-accent, var(--app-accent)) 14%, transparent)',
                    color: 'var(--analytics-accent, var(--app-accent))',
                  }}
                >
                  <CheckCircle2 className="h-5 w-5" />
                </span>
              </div>

              <div className="mt-6 flex items-center justify-center">
                <div
                  className="relative aspect-square w-full max-w-[220px] rounded-full"
                  style={{
                    background: `conic-gradient(
                      var(--analytics-accent, var(--app-accent)) 0% ${filteredSummary.completion_rate}%,
                      color-mix(in srgb, var(--app-highlight) 70%, transparent) ${filteredSummary.completion_rate}% 100%
                    )`,
                  }}
                >
                  <div className="absolute inset-[16%] rounded-full border border-[var(--app-border)] bg-[var(--app-panel-strong)]" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] app-text-muted">Completion</p>
                    <p className="mt-2 text-4xl font-semibold tracking-tight">{completionRate}</p>
                    <p className="mt-2 text-xs leading-5 app-text-muted">
                      {filteredSummary.completed_todos} of {filteredSummary.total_todos} todos
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                <article className="rounded-[1.25rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_82%,transparent)] px-4 py-3.5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] app-text-muted">Updated snapshot</p>
                  <p className="mt-2 text-base font-semibold">{generatedAt}</p>
                </article>
                <article className="rounded-[1.25rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_82%,transparent)] px-4 py-3.5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] app-text-muted">Unassigned risk</p>
                  <p className="mt-2 text-base font-semibold">{filteredSummary.unassigned_todos} todos</p>
                </article>
              </div>
            </Surface>
          </motion.div>
        </div>
      </PageHero>

      <Surface variant="strong" className="sticky top-3 z-20 rounded-[1.45rem] p-3 sm:p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] xl:items-start">
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

          <div className="grid gap-2 lg:grid-cols-[minmax(240px,1fr)_minmax(0,1fr)]">
            <label className="app-select-shell flex items-center gap-2 px-3 py-2">
              <Filter className="h-4 w-4 app-text-muted" />
              <span className="sr-only">Filter by category</span>
              <select
                value={selectedCategoryId}
                aria-label="Filter by category"
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
              value={scope}
              onChange={setScope}
              options={[
                { value: 'completed', label: 'Completed' },
                { value: 'active', label: 'Active' },
                { value: 'all', label: 'All' },
              ]}
              ariaLabel="Analytics scope"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>
            <Target className="h-3.5 w-3.5" />
            {selectedCategoryName}
          </Badge>
          <Badge>
            <BarChart3 className="h-3.5 w-3.5" />
            {scopeLabel(deferredScope)}
          </Badge>
          <Badge>
            <Layers3 className="h-3.5 w-3.5" />
            {filteredSummary.category_count} workflow stages
          </Badge>
          <Badge>
            <Users2 className="h-3.5 w-3.5" />
            {filtered.members.length} contributors
          </Badge>
        </div>
      </Surface>

      <motion.section id="overview" className="scroll-mt-28" {...sectionMotion(shouldReduceMotion, 0.03)}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="app-kicker">Overview</p>
            <h2 className="mt-1 text-2xl font-semibold">Executive Snapshot</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 app-text-muted">
              High-signal KPIs and derived insights for {selectedCategoryName.toLowerCase()}.
            </p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-[var(--analytics-accent)]" />
        </div>

        <div className="grid gap-4">
          <AnalyticsSummaryCards summary={filteredSummary} selectedCategoryName={selectedCategoryName} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <Surface variant="strong" className="rounded-[1.7rem] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="app-kicker">Progress Split</p>
                  <h3 className="mt-1 text-xl font-semibold">Completed vs Active</h3>
                </div>
                <BarChart3 className="h-5 w-5 text-[var(--analytics-accent)]" />
              </div>
              <div className="mt-5 min-h-[320px]">
                <AnalyticsCompletionDonut
                  items={completionItems}
                  centerLabel="Completion"
                  centerValue={completionRate}
                  emptyLabel="No todos to chart yet for this filter."
                />
              </div>
            </Surface>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {operationalInsights.map((insight) => (
                <AnalyticsInsightCard
                  key={insight.id}
                  icon={insight.icon}
                  title={insight.title}
                  value={insight.value}
                  detail={insight.detail}
                  tone={insight.tone}
                  className="h-full"
                />
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section id="workflow" className="scroll-mt-28" {...sectionMotion(shouldReduceMotion, 0.05)}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="app-kicker">Workflow</p>
            <h2 className="mt-1 text-2xl font-semibold">Category Performance</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 app-text-muted">
              Compare active pressure and completed output across the visible workflow stages.
            </p>
          </div>
          <Layers3 className="h-5 w-5 text-[var(--analytics-accent)]" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Surface variant="strong" className="rounded-[1.7rem] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-kicker">Workflow Load</p>
                <h3 className="mt-1 text-xl font-semibold">{scopeLabel(deferredScope)} by category</h3>
              </div>
              <Badge>{selectedCategoryName}</Badge>
            </div>
            <div className="mt-5 min-h-[360px]">
              <AnalyticsCategoryBarChart
                items={categoryBarItems}
                scope={deferredScope}
                emptyLabel="No todos in this workflow scope yet."
              />
            </div>
          </Surface>

          <Surface variant="strong" className="rounded-[1.7rem] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-kicker">Workflow Detail</p>
                <h3 className="mt-1 text-xl font-semibold">Ranked category signals</h3>
              </div>
              <Badge>{filteredSummary.total_todos} total visible</Badge>
            </div>
            <div className="mt-5">
              <AnalyticsCategoryBreakdown
                categories={filtered.categories}
                totalTodos={filteredSummary.total_todos}
              />
            </div>
          </Surface>
        </div>
      </motion.section>

      <motion.section id="members" className="scroll-mt-28" {...sectionMotion(shouldReduceMotion, 0.07)}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="app-kicker">Members</p>
            <h2 className="mt-1 text-2xl font-semibold">Contributor Throughput</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 app-text-muted">
              Balance output and completion quality to spot overloaded or underutilized teammates.
            </p>
          </div>
          <Users2 className="h-5 w-5 text-[var(--analytics-accent)]" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
          <Surface variant="strong" className="rounded-[1.7rem] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-kicker">Contributor Map</p>
                <h3 className="mt-1 text-xl font-semibold">{scopeLabel(deferredScope)} vs completion</h3>
              </div>
              <Badge>{filtered.members.length} visible members</Badge>
            </div>
            <div className="mt-5 min-h-[360px]">
              <AnalyticsMemberScatterChart
                items={memberScatterItems}
                scope={deferredScope}
                benchmarkCompletionRate={filteredSummary.completion_rate}
                emptyLabel="No assigned work yet for this filter."
              />
            </div>
          </Surface>

          <Surface variant="strong" className="rounded-[1.7rem] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-kicker">Leaderboard</p>
                <h3 className="mt-1 text-xl font-semibold">Top contributors in view</h3>
              </div>
              <Badge>{scopeLabel(deferredScope)}</Badge>
            </div>
            <div className="mt-5">
              <AnalyticsMemberLeaderboard members={filtered.members} scope={deferredScope} />
            </div>
          </Surface>
        </div>
      </motion.section>

      <motion.section id="labels" className="scroll-mt-28" {...sectionMotion(shouldReduceMotion, 0.09)}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="app-kicker">Labels</p>
            <h2 className="mt-1 text-2xl font-semibold">Label Concentration</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 app-text-muted">
              Surface the tags that dominate the current scope and compare completion quality across them.
            </p>
          </div>
          <Tags className="h-5 w-5 text-[var(--analytics-accent)]" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
          <Surface variant="strong" className="rounded-[1.7rem] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-kicker">Label Signal Map</p>
                <h3 className="mt-1 text-xl font-semibold">Treemap of visible labels</h3>
              </div>
              <Badge>{scopeLabel(deferredScope)}</Badge>
            </div>
            <div className="mt-5 min-h-[360px]">
              <AnalyticsLabelTreemap
                items={labelTreemapItems}
                scope={deferredScope}
                emptyLabel="No label activity yet for this filter."
              />
            </div>
          </Surface>

          <Surface variant="strong" className="rounded-[1.7rem] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-kicker">Label Detail</p>
                <h3 className="mt-1 text-xl font-semibold">Breakdown rail</h3>
              </div>
              <Badge>{filtered.labels.length} labels visible</Badge>
            </div>
            <div className="mt-5">
              <AnalyticsLabelBreakdown labels={filtered.labels} scope={deferredScope} />
            </div>
          </Surface>
        </div>
      </motion.section>
    </div>
  );
}
