'use client'

import Link from 'next/link'
import { BarChart3, CalendarClock, Layers3, ListTodo, Settings2, Tags } from 'lucide-react'

import BoardViewSwitcher from './BoardViewSwitcher'

import type { BoardBaseData } from '@/lib/types/boardTypes'
import type { BoardDisplayView } from '@/lib/types/boardViewTypes'

export default function BoardHeader({
  boardId,
  board,
  categoryCount,
  todoCount,
  labelCount,
  dueSoonCount,
  completedCount,
  activeView,
  onChangeView,
  onAddTodo,
  isManagingCategories,
  onToggleManageCategories,
}: {
  boardId: string
  board: BoardBaseData
  categoryCount: number
  todoCount: number
  labelCount: number
  dueSoonCount: number
  completedCount: number
  activeView: BoardDisplayView
  onChangeView: (view: BoardDisplayView) => void
  onAddTodo: () => void
  isManagingCategories: boolean
  onToggleManageCategories: () => void
}) {
  const accentColor = board.color || '#2563eb'

  return (
    <section
      className="glass-panel-strong rounded-[2rem] p-7 sm:p-9"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 16%, var(--app-panel-strong)), var(--app-panel-strong))`,
      }}
    >
      <div className="flex flex-col gap-9">
        <div className="flex flex-col gap-9 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="app-kicker">Board Workspace</p>
            <div className="mt-3 flex items-center gap-3">
              <span
                className="h-4 w-4 rounded-full"
                style={{
                  backgroundColor: accentColor,
                  boxShadow: `0 0 0 8px color-mix(in srgb, ${accentColor} 18%, transparent)`,
                }}
              />
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{board.name}</h1>
            </div>
            <p className="mt-4 max-w-2xl text-base leading-7 app-text-muted">
              Switch between list, kanban, and calendar layouts without leaving the board or losing the same
              task workflow controls.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="app-badge">
                <Layers3 className="h-3.5 w-3.5" />
                {categoryCount} categories
              </span>
              <span className="app-badge">
                <ListTodo className="h-3.5 w-3.5" />
                {todoCount} todos
              </span>
              <span className="app-badge">
                <Tags className="h-3.5 w-3.5" />
                {labelCount} labels
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={onAddTodo} className="glass-button glass-button-primary">
              <ListTodo className="h-4 w-4" />
              Add Todo
            </button>
            <Link href={`/dashboard/${boardId}/analytics`} className="glass-button">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Link>
            {activeView !== 'calendar' ? (
              <button onClick={onToggleManageCategories} className="glass-button">
                <Settings2 className="h-4 w-4" />
                {isManagingCategories ? 'Exit Manage Mode' : 'Manage Categories'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <BoardViewSwitcher activeView={activeView} onChangeView={onChangeView} />

          <div className="grid gap-4 sm:grid-cols-3 lg:min-w-[560px] lg:flex-1">
            <BoardMetricCard title="Tracked Todos" value={todoCount} icon={<ListTodo className="h-5 w-5" />} />
            <BoardMetricCard title="Due This Week" value={dueSoonCount} icon={<CalendarClock className="h-5 w-5" />} />
            <BoardMetricCard title="Completed" value={completedCount} icon={<Tags className="h-5 w-5" />} />
          </div>
        </div>
      </div>
    </section>
  )
}

function BoardMetricCard({
  title,
  value,
  icon,
}: {
  title: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <article className="glass-panel rounded-[1.5rem] p-5">
      <div className="flex items-start justify-between gap-4">
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
    </article>
  )
}
