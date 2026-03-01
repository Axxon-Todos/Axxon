'use client'

import { CalendarDays, Columns3, Rows3 } from 'lucide-react'
import { motion } from 'framer-motion'

import type { BoardDisplayView } from '@/lib/types/boardViewTypes'

const viewOptions: Array<{ value: BoardDisplayView; label: string; icon: React.ReactNode }> = [
  { value: 'list', label: 'List', icon: <Rows3 className="h-4 w-4" /> },
  { value: 'kanban', label: 'Kanban', icon: <Columns3 className="h-4 w-4" /> },
  { value: 'calendar', label: 'Calendar', icon: <CalendarDays className="h-4 w-4" /> },
]

export default function BoardViewSwitcher({
  activeView,
  onChangeView,
}: {
  activeView: BoardDisplayView
  onChangeView: (view: BoardDisplayView) => void
}) {
  return (
    <div
      className="relative inline-flex flex-wrap gap-2 rounded-[1.4rem] border border-[var(--app-border)] p-1.5"
      style={{ background: 'color-mix(in srgb, var(--app-panel) 88%, transparent)' }}
      role="tablist"
      aria-label="Board views"
    >
      {viewOptions.map((option) => {
        const isActive = option.value === activeView

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChangeView(option.value)}
            className={`relative z-10 inline-flex min-w-[8.5rem] items-center justify-center gap-2 rounded-[1rem] px-4 py-3 text-sm font-medium transition-colors ${
              isActive ? 'text-slate-950' : 'app-text-muted'
            }`}
          >
            {isActive ? (
              <motion.span
                layoutId="board-view-switcher-active-pill"
                className="absolute inset-0 rounded-[1rem]"
                style={{
                  background:
                    'linear-gradient(135deg, color-mix(in srgb, var(--app-accent) 22%, white), color-mix(in srgb, var(--app-accent) 14%, white))',
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-2">
              {option.icon}
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
