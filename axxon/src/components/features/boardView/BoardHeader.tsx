// Renders the shared board workspace hero, actions, metrics, and view switching controls.
'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { BarChart3, CalendarClock, Layers3, ListTodo, Settings2, Tags } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import Button, { buttonClassName } from '@/components/ui/Button'
import PageHero from '@/components/ui/PageHero'
import Surface from '@/components/ui/Surface'
import { useOrganizationRouteParams } from '@/hooks/useOrganizationRouteParams'
import {
  buildOrganizationBoardAnalyticsPath,
  buildOrganizationBoardSettingsPath,
} from '@/lib/utils/routes'

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
  const { organizationId } = useOrganizationRouteParams()
  const accentColor = board.color || '#2fd087'

  return (
    <PageHero
      kicker="Board Workspace"
      title={board.name}
      description="Switch between list, kanban, and calendar layouts without leaving the board or losing the same task workflow controls."
      accentColor={accentColor}
      actions={
        <>
          <Button variant="primary" onClick={onAddTodo}>
            <ListTodo className="h-4 w-4" />
            Add Todo
          </Button>
          <Link
            href={buildOrganizationBoardAnalyticsPath(organizationId, boardId)}
            className={buttonClassName({})}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Link>
          <Link
            href={buildOrganizationBoardSettingsPath(organizationId, boardId)}
            className={buttonClassName({})}
          >
            <Settings2 className="h-4 w-4" />
            Settings
          </Link>
          {activeView !== 'calendar' ? (
            <Button onClick={onToggleManageCategories}>
              <Layers3 className="h-4 w-4" />
              {isManagingCategories ? 'Exit Manage Mode' : 'Manage Categories'}
            </Button>
          ) : null}
        </>
      }
      badges={
        <>
          <Badge>
            <Layers3 className="h-3.5 w-3.5" />
            {categoryCount} categories
          </Badge>
          <Badge>
            <ListTodo className="h-3.5 w-3.5" />
            {todoCount} todos
          </Badge>
          <Badge>
            <Tags className="h-3.5 w-3.5" />
            {labelCount} labels
          </Badge>
        </>
      }
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <BoardViewSwitcher activeView={activeView} onChangeView={onChangeView} />

        <div className="grid gap-4 sm:grid-cols-3 lg:min-w-[560px] lg:flex-1">
          <BoardMetricCard title="Tracked Todos" value={todoCount} icon={<ListTodo className="h-5 w-5" />} />
          <BoardMetricCard title="Due This Week" value={dueSoonCount} icon={<CalendarClock className="h-5 w-5" />} />
          <BoardMetricCard title="Completed" value={completedCount} icon={<Tags className="h-5 w-5" />} />
        </div>
      </div>
    </PageHero>
  )
}

function BoardMetricCard({
  title,
  value,
  icon,
}: {
  title: string
  value: number
  icon: ReactNode
}) {
  return (
    <Surface variant="default" className="rounded-[1.5rem] p-5">
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
    </Surface>
  )
}
