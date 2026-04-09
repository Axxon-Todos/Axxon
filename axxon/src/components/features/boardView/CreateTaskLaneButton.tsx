// Renders the shared lane-level create action so list and kanban categories open the todo drawer consistently.
'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

type CreateTaskLaneButtonProps = {
  categoryName: string
  disabled?: boolean
  disabledMessage?: string
  onClick: () => void
}

export default function CreateTaskLaneButton({
  categoryName,
  disabled = false,
  disabledMessage = 'Task creation is unavailable here.',
  onClick,
}: CreateTaskLaneButtonProps) {
  const [supportsHover, setSupportsHover] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
    if (!hoverQuery || typeof hoverQuery.matches !== 'boolean') {
      return
    }

    const syncSupportsHover = () => setSupportsHover(hoverQuery.matches)

    syncSupportsHover()

    if (typeof hoverQuery.addEventListener === 'function') {
      hoverQuery.addEventListener('change', syncSupportsHover)
      return () => hoverQuery.removeEventListener('change', syncSupportsHover)
    }

    hoverQuery.addListener(syncSupportsHover)
    return () => hoverQuery.removeListener(syncSupportsHover)
  }, [])

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`${disabled ? 'Task creation unavailable' : 'Create task'} in ${categoryName}`}
      className={cn(
        'w-full rounded-[1.35rem] border border-dashed px-4 py-4 text-left transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--app-accent)_60%,transparent)] focus-visible:ring-offset-0',
        disabled
          ? 'cursor-not-allowed border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] opacity-100'
          : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-strong)_78%,transparent)] hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--app-accent)_30%,var(--app-border))] hover:bg-[color-mix(in_srgb,var(--app-panel-strong)_92%,transparent)]',
        supportsHover && !disabled ? 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100' : 'translate-y-0 opacity-100'
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-[var(--app-foreground-strong)]">
        <Plus className="h-4 w-4 text-[var(--app-accent)]" />
        Create task
      </span>
      <span className="mt-2 block text-sm leading-6 app-text-muted">
        {disabled ? disabledMessage : `Add a task to ${categoryName}. New items land at the bottom of this lane.`}
      </span>
    </button>
  )
}
