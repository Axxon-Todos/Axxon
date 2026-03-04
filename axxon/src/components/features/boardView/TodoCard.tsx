'use client'

import dayjs from 'dayjs'
import { AlertCircle, CheckCircle2, Clock3, UserRound } from 'lucide-react'

import type { TodoWithLabels } from '@/lib/types/todoTypes'

const priorityMap: Record<number, { label: string; color: string }> = {
  1: { label: 'None', color: '#94a3b8' },
  2: { label: 'Low', color: '#22c55e' },
  3: { label: 'Medium', color: '#f59e0b' },
  4: { label: 'High', color: '#ef4444' },
}

interface TodoCardProps {
  todo: TodoWithLabels
  labelControl?: React.ReactNode
  elevated?: boolean
  isDragging?: boolean
}

export default function TodoCard({ todo, labelControl, elevated = false, isDragging = false }: TodoCardProps) {
  const priority = priorityMap[todo.priority || 1]
  const dueDate = todo.due_date ? dayjs(todo.due_date) : null
  const isOverdue = Boolean(dueDate && !todo.is_complete && dueDate.isBefore(dayjs(), 'day'))

  return (
    <div
      className={`glass-panel rounded-[1.35rem] p-4 transition-transform ${
        elevated ? 'rotate-[0.6deg] shadow-[0_32px_80px_-34px_rgba(15,23,42,0.72)]' : ''
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold">{todo.title}</h3>
              {todo.is_complete && <span className="app-badge text-emerald-500">Complete</span>}
              {isOverdue && <span className="app-badge text-rose-400">Overdue</span>}
            </div>
            {todo.description ? (
              <p className="mt-2 line-clamp-2 text-sm leading-6 app-text-muted">{todo.description}</p>
            ) : (
              <p className="mt-2 text-sm leading-6 app-text-muted">No description added yet.</p>
            )}
          </div>

          {labelControl ? <div className="self-start">{labelControl}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="app-badge" style={{ color: priority.color }}>
            <AlertCircle className="h-3.5 w-3.5" />
            {priority.label} priority
          </span>
          {dueDate ? (
            <span className="app-badge" style={isOverdue ? { color: '#f87171' } : undefined}>
              <Clock3 className="h-3.5 w-3.5" />
              {dueDate.format('MMM D')}
            </span>
          ) : null}
          {todo.is_complete ? (
            <span className="app-badge text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done
            </span>
          ) : null}
          {todo.assignee_id ? (
            <span className="app-badge">
              <UserRound className="h-3.5 w-3.5" />
              Assignee #{todo.assignee_id}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
