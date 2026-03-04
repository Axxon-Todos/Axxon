'use client'

import Link from 'next/link'
import dayjs from 'dayjs'
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock3,
  Layers3,
  ListTodo,
} from 'lucide-react'

import Calendar, { type CalendarTodo } from '@/components/common/calendar'
import TaskDetailsDrawer from '@/components/features/dashboard/TaskDetailsDrawer'
import PaginationControls from '@/components/ui/PaginationControls'
import { fetchBoards } from '@/lib/api/boards/getBoards'
import { fetchCategories } from '@/lib/api/categories/getCategories'
import { fetchTodos } from '@/lib/api/todos/getTodos'
import { getUserId } from '@/lib/api/users/getUserId'

import type { BoardBaseData } from '@/lib/types/boardTypes'
import type { CategoryBaseData } from '@/lib/types/categoryTypes'
import type { TodoBaseData } from '@/lib/types/todoTypes'

type DashboardTodo = TodoBaseData & {
  boardName: string
  boardColor: string
  categoryName?: string
}

type BoardSummary = {
  board: BoardBaseData
  totalTodos: number
  dueSoon: number
}

type PanelKey = 'selected' | 'overdue' | 'upcoming'

type PanelItem = {
  id: number | string
  title: string
  boardName?: string
  boardId?: string
  color?: string
  dueDate?: string
}

const TODAY_KEY = dayjs().format('YYYY-MM-DD')
const TASKS_PER_PAGE = 5

export default function DashboardOverview() {
  const [selectedDate, setSelectedDate] = useState(TODAY_KEY)
  const [panelPages, setPanelPages] = useState<Record<PanelKey, number>>({
    selected: 1,
    overdue: 1,
    upcoming: 1,
  })
  const [selectedTodo, setSelectedTodo] = useState<CalendarTodo | null>(null)

  const { data: userId, isLoading: isUserLoading, error: userError } = useQuery({
    queryKey: ['id'],
    queryFn: getUserId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: boards = [], isLoading: isBoardsLoading, error: boardsError } = useQuery({
    queryKey: ['boards', userId],
    queryFn: () => fetchBoards(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const todoQueries = useQueries({
    queries: boards.map((board) => ({
      queryKey: ['dashboard-todos', board.id],
      queryFn: () => fetchTodos(String(board.id)),
      staleTime: 60 * 1000,
    })),
  })

  const categoryQueries = useQueries({
    queries: boards.map((board) => ({
      queryKey: ['dashboard-categories', board.id],
      queryFn: () => fetchCategories(String(board.id)),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const isTodosLoading = boards.length > 0 && todoQueries.some((query) => query.isLoading)
  const todosError = todoQueries.find((query) => query.error)?.error
  const isCategoriesLoading = boards.length > 0 && categoryQueries.some((query) => query.isLoading)
  const categoriesError = categoryQueries.find((query) => query.error)?.error

  const boardSummaryMap = new Map<string, BoardSummary>()
  const categoryMapByBoard = new Map<string, Map<number, string>>()
  const allTodos: DashboardTodo[] = []
  const todosByDate: Record<string, CalendarTodo[]> = {}
  const overdueTodos: DashboardTodo[] = []
  const todayTodos: DashboardTodo[] = []
  const upcomingTodos: DashboardTodo[] = []

  for (const board of boards) {
    boardSummaryMap.set(String(board.id), {
      board,
      totalTodos: 0,
      dueSoon: 0,
    })
  }

  boards.forEach((board, index) => {
    const categories = (categoryQueries[index]?.data ?? []) as CategoryBaseData[]
    categoryMapByBoard.set(
      String(board.id),
      new Map(categories.map((category) => [category.id, category.name]))
    )
  })

  boards.forEach((board, index) => {
    const todos = (todoQueries[index]?.data ?? []) as TodoBaseData[]
    const categoryMap = categoryMapByBoard.get(String(board.id))

    for (const todo of todos) {
      const hydratedTodo: DashboardTodo = {
        ...todo,
        boardName: board.name || 'Untitled Board',
        boardColor: board.color || '#2563eb',
        categoryName: todo.category_id ? categoryMap?.get(todo.category_id) : undefined,
      }

      allTodos.push(hydratedTodo)

      const boardSummary = boardSummaryMap.get(String(board.id))
      if (boardSummary) {
        boardSummary.totalTodos += 1
      }

      if (!todo.due_date) continue

      const dueDate = dayjs(todo.due_date)
      const dateKey = dueDate.format('YYYY-MM-DD')

      if (!todosByDate[dateKey]) {
        todosByDate[dateKey] = []
      }

      todosByDate[dateKey].push({
        id: todo.id,
        title: todo.title,
        color: hydratedTodo.boardColor,
        boardId: String(board.id),
        boardName: hydratedTodo.boardName,
        categoryId: todo.category_id,
        categoryName: hydratedTodo.categoryName,
        description: todo.description,
        priority: todo.priority,
        dueDate: todo.due_date,
        assigneeId: todo.assignee_id,
        isComplete: todo.is_complete,
      })

      if (todo.is_complete) continue

      if (dueDate.isBefore(dayjs(), 'day')) {
        overdueTodos.push(hydratedTodo)
      }

      if (dueDate.isSame(dayjs(), 'day')) {
        todayTodos.push(hydratedTodo)
      }

      if (dueDate.isAfter(dayjs().subtract(1, 'day'), 'day') && dueDate.diff(dayjs(), 'day') <= 7) {
        upcomingTodos.push(hydratedTodo)
        if (boardSummary) {
          boardSummary.dueSoon += 1
        }
      }
    }
  })

  const boardSummaries = Array.from(boardSummaryMap.values())
    .sort((a, b) => b.dueSoon - a.dueSoon || b.totalTodos - a.totalTodos)
    .slice(0, 4)

  const selectedDateTodos = (todosByDate[selectedDate] ?? [])
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))

  const overduePanelItems = overdueTodos
    .slice()
    .sort((a, b) => dayjs(a.due_date).valueOf() - dayjs(b.due_date).valueOf())
    .map((todo) => ({
      id: todo.id,
      title: todo.title,
      boardName: todo.boardName,
      boardId: String(todo.board_id),
      color: todo.boardColor,
      dueDate: todo.due_date,
    }))

  const upcomingPanelItems = upcomingTodos
    .slice()
    .sort((a, b) => dayjs(a.due_date).valueOf() - dayjs(b.due_date).valueOf())
    .map((todo) => ({
      id: todo.id,
      title: todo.title,
      boardName: todo.boardName,
      boardId: String(todo.board_id),
      color: todo.boardColor,
      dueDate: todo.due_date,
    }))

  useEffect(() => {
    const nextPageCounts: Record<PanelKey, number> = {
      selected: getPageCount(selectedDateTodos.length),
      overdue: getPageCount(overduePanelItems.length),
      upcoming: getPageCount(upcomingPanelItems.length),
    }

    setPanelPages((current) => {
      const nextState: Record<PanelKey, number> = {
        selected: clampPage(current.selected, nextPageCounts.selected),
        overdue: clampPage(current.overdue, nextPageCounts.overdue),
        upcoming: clampPage(current.upcoming, nextPageCounts.upcoming),
      }

      if (
        nextState.selected === current.selected &&
        nextState.overdue === current.overdue &&
        nextState.upcoming === current.upcoming
      ) {
        return current
      }

      return nextState
    })
  }, [selectedDateTodos.length, overduePanelItems.length, upcomingPanelItems.length])

  const isLoading = isUserLoading || isBoardsLoading || isTodosLoading || isCategoriesLoading
  const hasError = userError || boardsError || todosError || categoriesError

  if (!isLoading && !userId) {
    return (
      <div className="mx-auto max-w-[1480px]">
        <section className="glass-panel-strong rounded-[2rem] p-8">
          <p className="app-kicker">Dashboard</p>
          <h1 className="mt-3 text-3xl font-semibold">Sign in to view your workspace</h1>
          <p className="mt-3 max-w-2xl app-text-muted">
            Your planning dashboard is available after authentication so board and todo data can be loaded.
          </p>
        </section>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
        <section className="glass-panel-strong rounded-[2rem] p-8">
          <div className="space-y-3">
            <div className="h-3 w-32 rounded-full bg-white/30" />
            <div className="h-12 w-72 rounded-full bg-white/35" />
            <div className="h-4 w-96 rounded-full bg-white/20" />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="glass-panel h-32 rounded-[1.5rem] bg-white/15" />
            ))}
          </div>
        </section>
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_24rem]">
          <div className="glass-panel-strong h-[46rem] rounded-[2rem] bg-white/12" />
          <div className="space-y-6">
            <div className="glass-panel h-64 rounded-[2rem] bg-white/12" />
            <div className="glass-panel h-64 rounded-[2rem] bg-white/12" />
          </div>
        </section>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="mx-auto max-w-[1480px]">
        <section className="glass-panel-strong rounded-[2rem] p-8">
          <p className="app-kicker">Dashboard</p>
          <h1 className="mt-3 text-3xl font-semibold">Unable to load planning data</h1>
          <p className="mt-3 max-w-2xl app-text-muted">
            The dashboard could not fetch your board, category, or todo data. Refresh the page and try again.
          </p>
        </section>
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
        <section className="glass-panel-strong rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="app-kicker">Planning Overview</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Deadlines, boards, and work in one view.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 app-text-muted">
                Review what needs attention today, what is drifting overdue, and which boards are driving
                the next wave of work.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="app-badge">
                <CalendarDays className="h-3.5 w-3.5" />
                {dayjs().format('dddd, MMMM D')}
              </span>
              <span className="app-badge">
                <Layers3 className="h-3.5 w-3.5" />
                {boards.length} boards
              </span>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DashboardStatCard
              title="Boards"
              value={boards.length}
              caption="Active workspaces"
              icon={<Layers3 className="h-5 w-5" />}
            />
            <DashboardStatCard
              title="Due Today"
              value={todayTodos.length}
              caption="Tasks needing action today"
              icon={<Clock3 className="h-5 w-5" />}
            />
            <DashboardStatCard
              title="Overdue"
              value={overdueTodos.length}
              caption="Unfinished tasks behind schedule"
              icon={<AlertTriangle className="h-5 w-5" />}
              tone="danger"
            />
            <DashboardStatCard
              title="Tracked Todos"
              value={allTodos.length}
              caption="Across all current boards"
              icon={<ListTodo className="h-5 w-5" />}
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_24rem]">
          <Calendar
            todosByDate={todosByDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onSelectTodo={setSelectedTodo}
          />

          <div className="space-y-6">
            <TaskPanel
              title="Selected Day"
              subtitle={dayjs(selectedDate).format('dddd, MMM D')}
              emptyMessage="No due items scheduled for this day."
              items={slicePage(selectedDateTodos, panelPages.selected)}
              totalCount={selectedDateTodos.length}
              page={panelPages.selected}
              pageCount={getPageCount(selectedDateTodos.length)}
              onPrevious={() => changePanelPage('selected', -1, setPanelPages)}
              onNext={() => changePanelPage('selected', 1, setPanelPages)}
            />

            <TaskPanel
              title="Overdue"
              subtitle="Past due and still incomplete"
              emptyMessage="Nothing overdue right now."
              items={slicePage(overduePanelItems, panelPages.overdue)}
              tone="danger"
              totalCount={overduePanelItems.length}
              page={panelPages.overdue}
              pageCount={getPageCount(overduePanelItems.length)}
              onPrevious={() => changePanelPage('overdue', -1, setPanelPages)}
              onNext={() => changePanelPage('overdue', 1, setPanelPages)}
            />

            <TaskPanel
              title="Next 7 Days"
              subtitle="Upcoming due dates"
              emptyMessage="No upcoming deadlines in the next week."
              items={slicePage(upcomingPanelItems, panelPages.upcoming)}
              totalCount={upcomingPanelItems.length}
              page={panelPages.upcoming}
              pageCount={getPageCount(upcomingPanelItems.length)}
              onPrevious={() => changePanelPage('upcoming', -1, setPanelPages)}
              onNext={() => changePanelPage('upcoming', 1, setPanelPages)}
            />

            <section className="glass-panel rounded-[1.75rem] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="app-kicker">Boards Snapshot</p>
                  <h2 className="mt-2 text-xl font-semibold">Where deadlines are clustering</h2>
                </div>
                <span className="app-badge">{boardSummaries.length} shown</span>
              </div>

              <div className="mt-5 space-y-3">
                {boardSummaries.length === 0 ? (
                  <p className="text-sm app-text-muted">Create a board to start building your planning view.</p>
                ) : (
                  boardSummaries.map(({ board, totalTodos, dueSoon }) => (
                    <Link
                      key={board.id}
                      href={`/dashboard/${board.id}`}
                      className="glass-panel block rounded-[1.25rem] p-4 hover:-translate-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{
                                backgroundColor: board.color || '#2563eb',
                                boxShadow: `0 0 0 6px color-mix(in srgb, ${board.color || '#2563eb'} 18%, transparent)`,
                              }}
                            />
                            <p className="truncate font-semibold">{board.name || 'Untitled Board'}</p>
                          </div>
                          <p className="mt-2 text-sm app-text-muted">
                            {totalTodos} todos, {dueSoon} due in the next week
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 app-text-muted" />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </div>

      <TaskDetailsDrawer
        todo={selectedTodo}
        isOpen={selectedTodo !== null}
        onClose={() => setSelectedTodo(null)}
      />
    </>
  )
}

function DashboardStatCard({
  title,
  value,
  caption,
  icon,
  tone = 'default',
}: {
  title: string
  value: number
  caption: string
  icon: React.ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <article
      className="glass-panel rounded-[1.5rem] p-5"
      style={
        tone === 'danger'
          ? {
              borderColor: 'color-mix(in srgb, rgb(248 113 113) 28%, var(--app-border))',
              background: 'color-mix(in srgb, rgba(248, 113, 113, 0.12) 58%, var(--app-panel))',
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium app-text-muted">{title}</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{value}</p>
        </div>
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--app-accent)]"
          style={{ background: 'color-mix(in srgb, var(--app-accent) 12%, transparent)' }}
        >
          {icon}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 app-text-muted">{caption}</p>
    </article>
  )
}

function TaskPanel({
  title,
  subtitle,
  emptyMessage,
  items,
  totalCount,
  page,
  pageCount,
  onPrevious,
  onNext,
  tone = 'default',
}: {
  title: string
  subtitle: string
  emptyMessage: string
  items: PanelItem[]
  totalCount: number
  page: number
  pageCount: number
  onPrevious: () => void
  onNext: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <section
      className="glass-panel rounded-[1.75rem] p-5"
      style={
        tone === 'danger'
          ? {
              borderColor: 'color-mix(in srgb, rgb(248 113 113) 24%, var(--app-border))',
            }
          : undefined
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="app-kicker">{title}</p>
          <h2 className="mt-2 text-xl font-semibold">{subtitle}</h2>
        </div>
        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
          <span className="app-badge">{totalCount}</span>
          <PaginationControls
            page={page}
            pageCount={pageCount}
            onPrevious={onPrevious}
            onNext={onNext}
            label={`${title} pagination`}
          />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm app-text-muted">{emptyMessage}</p>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.boardId ? `/dashboard/${item.boardId}` : '/dashboard'}
              className="glass-panel block rounded-[1.2rem] p-4 hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color || '#2563eb' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs app-text-muted">
                    {item.boardName ? <span className="app-badge">{item.boardName}</span> : null}
                    {item.dueDate ? <span className="app-badge">{dayjs(item.dueDate).format('MMM D')}</span> : null}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  )
}

function getPageCount(totalItems: number) {
  if (totalItems === 0) {
    return 0
  }

  return Math.ceil(totalItems / TASKS_PER_PAGE)
}

function clampPage(page: number, pageCount: number) {
  if (pageCount === 0) {
    return 1
  }

  return Math.min(Math.max(page, 1), pageCount)
}

function slicePage<T>(items: T[], page: number) {
  const start = (page - 1) * TASKS_PER_PAGE
  return items.slice(start, start + TASKS_PER_PAGE)
}

function changePanelPage(
  key: PanelKey,
  direction: -1 | 1,
  setPanelPages: Dispatch<SetStateAction<Record<PanelKey, number>>>
) {
  setPanelPages((current) => ({
    ...current,
    [key]: Math.max(1, current[key] + direction),
  }))
}
