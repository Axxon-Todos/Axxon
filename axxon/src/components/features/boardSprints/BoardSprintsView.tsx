'use client';

import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Archive, CalendarDays, ChevronDown, PencilLine, Plus, Rows3 } from 'lucide-react';
import clsx from 'clsx';

import BoardWorkspace from '@/components/features/boardView/BoardWorkspace';
import { fetchSprints } from '@/lib/api/sprints/getSprints';
import { fetchTodosWithLabels } from '@/lib/api/todos/getTodosWithLabels';
import type { SprintBaseData } from '@/lib/types/sprintTypes';
import type { TodoWithLabels } from '@/lib/types/todoTypes';
import { getSprintStatus, getSprintStatusLabel } from '@/lib/utils/sprintStatus';

import SprintEditorModal from './SprintEditorModal';
import { SprintIconGlyph } from './sprintIcons';

type SprintGroup = {
  active: SprintBaseData[];
  planned: SprintBaseData[];
  completed: SprintBaseData[];
  archived: SprintBaseData[];
};

function compareSprintDates(left: SprintBaseData, right: SprintBaseData) {
  return dayjs(left.start_date).valueOf() - dayjs(right.start_date).valueOf();
}

function groupSprints(sprints: SprintBaseData[]): SprintGroup {
  return sprints.reduce<SprintGroup>(
    (acc, sprint) => {
      const status = getSprintStatus(sprint);

      if (status === 'active') {
        acc.active.push(sprint);
      } else if (status === 'planned') {
        acc.planned.push(sprint);
      } else if (status === 'completed') {
        acc.completed.push(sprint);
      } else {
        acc.archived.push(sprint);
      }

      return acc;
    },
    { active: [], planned: [], completed: [], archived: [] }
  );
}

function formatSprintDateRange(sprint: SprintBaseData) {
  return `${dayjs(sprint.start_date).format('MMM D')} - ${dayjs(sprint.end_date).format('MMM D, YYYY')}`;
}

export default function BoardSprintsView({ boardId }: { boardId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showArchived, setShowArchived] = useState(false);
  const [editingSprint, setEditingSprint] = useState<SprintBaseData | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const {
    data: sprints = [],
    error: sprintsError,
    isLoading: isSprintsLoading,
  } = useQuery<SprintBaseData[]>({
    queryKey: ['sprints', boardId],
    queryFn: () => fetchSprints(boardId),
  });
  const {
    data: todos = [],
    error: todosError,
    isLoading: isTodosLoading,
  } = useQuery<TodoWithLabels[]>({
    queryKey: ['todos', boardId],
    queryFn: () => fetchTodosWithLabels(boardId),
  });

  const sprintGroups = useMemo(() => {
    const grouped = groupSprints(sprints);

    grouped.active.sort(compareSprintDates);
    grouped.planned.sort(compareSprintDates);
    grouped.completed.sort((left, right) => dayjs(right.end_date).valueOf() - dayjs(left.end_date).valueOf());
    grouped.archived.sort((left, right) => dayjs(right.updated_at).valueOf() - dayjs(left.updated_at).valueOf());

    return grouped;
  }, [sprints]);

  const selectedSprintId = useMemo(() => {
    const rawValue = searchParams.get('sprintId');
    const parsedValue = rawValue ? Number(rawValue) : null;
    return parsedValue && Number.isFinite(parsedValue) ? parsedValue : null;
  }, [searchParams]);

  const selectedSprint = useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? null,
    [selectedSprintId, sprints]
  );

  const defaultSprint = useMemo(
    () =>
      sprintGroups.active[0] ??
      sprintGroups.planned[0] ??
      sprintGroups.completed[0] ??
      sprintGroups.archived[0] ??
      null,
    [sprintGroups]
  );

  const todoCounts = useMemo(
    () =>
      todos.reduce<Record<number, number>>((acc, todo) => {
        if (typeof todo.sprint_id !== 'number') {
          return acc;
        }

        acc[todo.sprint_id] = (acc[todo.sprint_id] ?? 0) + 1;
        return acc;
      }, {}),
    [todos]
  );

  useEffect(() => {
    if (selectedSprint?.archived_at) {
      setShowArchived(true);
    }
  }, [selectedSprint]);

  useEffect(() => {
    if (!defaultSprint) {
      return;
    }

    if (selectedSprintId && selectedSprint) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('sprintId', String(defaultSprint.id));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [defaultSprint, pathname, router, searchParams, selectedSprint, selectedSprintId]);

  const setSelectedSprintId = (sprintId: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sprintId', String(sprintId));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSprintSaved = (sprint: SprintBaseData) => {
    setIsCreateModalOpen(false);
    setEditingSprint(null);
    setSelectedSprintId(sprint.id);
  };

  const hasSprints = sprints.length > 0;

  if (isSprintsLoading || isTodosLoading) {
    return (
      <div className="mx-auto max-w-[1480px]">
        <section className="glass-panel-strong rounded-[2rem] p-8">
          <p className="app-kicker">Sprint Hub</p>
          <h1 className="mt-3 text-3xl font-semibold">Loading sprints...</h1>
        </section>
      </div>
    );
  }

  if (sprintsError || todosError) {
    return (
      <div className="mx-auto max-w-[1480px]">
        <section className="glass-panel-strong rounded-[2rem] p-8">
          <p className="app-kicker">Sprint Hub</p>
          <h1 className="mt-3 text-3xl font-semibold">Unable to load sprints.</h1>
          <p className="mt-3 text-sm leading-6 app-text-muted">
            Refresh the page or revisit this board in a moment.
          </p>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
        <section className="glass-panel-strong rounded-[2rem] p-7 sm:p-9">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="app-kicker">Sprint Hub</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Sprints</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 app-text-muted">
                Plan time-boxed execution per board, then jump straight into a filtered workspace that only shows
                the sprint&apos;s tickets.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="app-badge">
                  <Rows3 className="h-3.5 w-3.5" />
                  {sprints.length} total sprints
                </span>
                <span className="app-badge">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {sprintGroups.active.length} active
                </span>
                <span className="app-badge">
                  <Archive className="h-3.5 w-3.5" />
                  {sprintGroups.archived.length} archived
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="glass-button glass-button-primary"
            >
              <Plus className="h-4 w-4" />
              New Sprint
            </button>
          </div>
        </section>

        {hasSprints ? (
          <section className="glass-panel rounded-[2rem] p-5 sm:p-6">
            <div className="space-y-6">
              <SprintRow
                title="Active"
                description="Current delivery windows that are in motion right now."
                sprints={sprintGroups.active}
                selectedSprintId={selectedSprint?.id ?? null}
                todoCounts={todoCounts}
                onSelect={setSelectedSprintId}
                onEdit={setEditingSprint}
              />

              <SprintRow
                title="Planned"
                description="Upcoming work that is ready to be scheduled."
                sprints={sprintGroups.planned}
                selectedSprintId={selectedSprint?.id ?? null}
                todoCounts={todoCounts}
                onSelect={setSelectedSprintId}
                onEdit={setEditingSprint}
              />

              <SprintRow
                title="Completed"
                description="Finished execution windows that still matter for reference."
                sprints={sprintGroups.completed}
                selectedSprintId={selectedSprint?.id ?? null}
                todoCounts={todoCounts}
                onSelect={setSelectedSprintId}
                onEdit={setEditingSprint}
              />

              {sprintGroups.archived.length > 0 ? (
                <div className="rounded-[1.6rem] border border-[var(--app-border)] p-4">
                  <button
                    type="button"
                    onClick={() => setShowArchived((previous) => !previous)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold">Archived</p>
                      <p className="mt-1 text-sm app-text-muted">
                        Hidden by default, but still available when older sprint context matters.
                      </p>
                    </div>
                    <span className="flex items-center gap-2 text-sm app-text-muted">
                      {sprintGroups.archived.length} archived
                      <ChevronDown className={clsx('h-4 w-4 transition-transform', showArchived && 'rotate-180')} />
                    </span>
                  </button>

                  {showArchived ? (
                    <div className="mt-4">
                      <SprintCardGrid
                        sprints={sprintGroups.archived}
                        selectedSprintId={selectedSprint?.id ?? null}
                        todoCounts={todoCounts}
                        onSelect={setSelectedSprintId}
                        onEdit={setEditingSprint}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="glass-panel rounded-[2rem] p-8 text-center">
            <p className="app-kicker">No Sprints Yet</p>
            <h2 className="mt-3 text-3xl font-semibold">Create the first sprint for this board.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 app-text-muted">
              Sprints become the focused execution windows that future AI-assisted planning and task operations can
              target without losing the board&apos;s wider context.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="glass-button glass-button-primary mt-6"
            >
              <Plus className="h-4 w-4" />
              Create Sprint
            </button>
          </section>
        )}

        {selectedSprint ? (
          <BoardWorkspace boardId={boardId} selectedSprint={selectedSprint} />
        ) : hasSprints ? (
          <section className="glass-panel rounded-[2rem] p-8">
            <p className="app-kicker">Select A Sprint</p>
            <h2 className="mt-3 text-3xl font-semibold">Choose a sprint to load its tickets.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 app-text-muted">
              Once selected, the workspace below switches into sprint scope while keeping the board&apos;s categories,
              list, kanban, and calendar views intact.
            </p>
          </section>
        ) : null}
      </div>

      {isCreateModalOpen ? (
        <SprintEditorModal
          boardId={Number(boardId)}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleSprintSaved}
        />
      ) : null}

      {editingSprint ? (
        <SprintEditorModal
          boardId={Number(boardId)}
          sprint={editingSprint}
          onClose={() => setEditingSprint(null)}
          onSuccess={handleSprintSaved}
        />
      ) : null}
    </>
  );
}

function SprintRow({
  title,
  description,
  sprints,
  selectedSprintId,
  todoCounts,
  onSelect,
  onEdit,
}: {
  title: string;
  description: string;
  sprints: SprintBaseData[];
  selectedSprintId: number | null;
  todoCounts: Record<number, number>;
  onSelect: (sprintId: number) => void;
  onEdit: (sprint: SprintBaseData) => void;
}) {
  if (sprints.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm app-text-muted">{description}</p>
      </div>
      <SprintCardGrid
        sprints={sprints}
        selectedSprintId={selectedSprintId}
        todoCounts={todoCounts}
        onSelect={onSelect}
        onEdit={onEdit}
      />
    </div>
  );
}

function SprintCardGrid({
  sprints,
  selectedSprintId,
  todoCounts,
  onSelect,
  onEdit,
}: {
  sprints: SprintBaseData[];
  selectedSprintId: number | null;
  todoCounts: Record<number, number>;
  onSelect: (sprintId: number) => void;
  onEdit: (sprint: SprintBaseData) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {sprints.map((sprint) => {
        const isSelected = sprint.id === selectedSprintId;
        const status = getSprintStatus(sprint);

        return (
          <article
            key={sprint.id}
            className={clsx(
              'glass-panel rounded-[1.6rem] border p-4 transition-[transform,border-color,background-color,box-shadow] duration-200',
              isSelected && 'shadow-[0_20px_45px_-32px_rgba(15,23,42,0.72)]'
            )}
            style={
              isSelected
                ? {
                    borderColor:
                      'color-mix(in srgb, var(--app-accent) 30%, var(--app-border))',
                    background:
                      'linear-gradient(145deg, color-mix(in srgb, var(--app-accent) 12%, var(--app-panel-strong)), var(--app-panel))',
                  }
                : undefined
            }
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => onSelect(sprint.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-2xl"
                    style={{
                      background: sprint.color
                        ? `color-mix(in srgb, ${sprint.color} 18%, transparent)`
                        : 'color-mix(in srgb, var(--app-accent) 12%, transparent)',
                      color: sprint.color || 'var(--app-accent)',
                    }}
                  >
                    <SprintIconGlyph icon={sprint.icon} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold">{sprint.name}</h3>
                    <p className="mt-1 text-sm app-text-muted">{formatSprintDateRange(sprint)}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 app-text-muted">
                  {sprint.description || 'No sprint description yet.'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => onEdit(sprint)}
                className="glass-button !h-10 !w-10 !p-0"
                aria-label={`Edit ${sprint.name}`}
              >
                <PencilLine className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="app-badge">{getSprintStatusLabel(status)}</span>
              <span className="app-badge">
                <Rows3 className="h-3.5 w-3.5" />
                {todoCounts[sprint.id] ?? 0} todos
              </span>
              {sprint.archived_at ? (
                <span className="app-badge">
                  <Archive className="h-3.5 w-3.5" />
                  Archived
                </span>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
