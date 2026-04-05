// Renders a board todo card using the refreshed token system for status, priority, and assignee metadata.
'use client'

import type { ReactNode } from 'react'
import dayjs from 'dayjs'
import { AlertCircle, CheckCircle2, Clock3, UserRound } from 'lucide-react'
import Badge from '@/components/ui/Badge'

import type { TodoWithLabels } from '@/lib/types/todoTypes'

const priorityMap: Record<number, { label: string; color: string }> = {
  1: { label: 'None', color: 'var(--app-muted)' },
  2: { label: 'Low', color: 'var(--app-success)' },
  3: { label: 'Medium', color: 'var(--app-warning)' },
  4: { label: 'High', color: 'var(--app-danger)' },
}

interface TodoCardProps {
  todo: TodoWithLabels
  labelControl?: ReactNode
  elevated?: boolean
}

export default function TodoCard({ todo, labelControl, elevated = false }: TodoCardProps) {
  const priority = priorityMap[todo.priority || 1]
  const dueDate = todo.due_date ? dayjs(todo.due_date) : null
  const isOverdue = Boolean(dueDate && !todo.is_complete && dueDate.isBefore(dayjs(), 'day'))

  return (
    <div
      className={`glass-panel rounded-[1.35rem] p-4 transition-transform ${
        elevated ? 'rotate-[0.6deg] shadow-[0_32px_80px_-34px_rgba(0,0,0,0.62)]' : ''
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold">{todo.title}</h3>
            {todo.is_complete ? (
              <Badge variant="success">Complete</Badge>
            ) : null}
            {isOverdue ? (
              <Badge variant="danger">Overdue</Badge>
            ) : null}
          </div>
          {todo.description ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 app-text-muted">{todo.description}</p>
          ) : (
            <p className="mt-2 text-sm leading-6 app-text-muted">No description added yet.</p>
          )}
        </div>

        {labelControl ? <div className="flex flex-wrap items-center gap-2">{labelControl}</div> : null}

        <div className="flex flex-wrap gap-2">
          <Badge style={{ color: priority.color }}>
            <AlertCircle className="h-3.5 w-3.5" />
            {priority.label} priority
          </Badge>
          {dueDate ? (
            <Badge variant={isOverdue ? 'danger' : 'default'}>
              <Clock3 className="h-3.5 w-3.5" />
              {dueDate.format('MMM D')}
            </Badge>
          ) : null}
          {todo.is_complete ? (
            <Badge variant="success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done
            </Badge>
          ) : null}
          {todo.assignee?.name ? (
            <Badge>
              <UserRound className="h-3.5 w-3.5" />
              <span className="truncate">{todo.assignee.name}</span>
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  )
}
